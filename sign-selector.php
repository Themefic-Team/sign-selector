<?php
/**
 * Plugin Name:  Sign Selector 
 * Description:  A simple plugin to select and display a sign on your WordPress site. 
 * Version: 1.0.4
 * Tested up to: 6.9
 * Author: Themefic
 * Author URI: https://themefic.com/
 * License: GPL-2.0+
 * License URI: http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain: sign-selector
 * Domain Path: /languages
 */

// don't load directly
defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/includes/class-sign-selector-admin.php';

class SignSelector {
    /** @var Sign_Selector_Admin */
    private $admin;
    public function __construct() {
        // constants
        if ( ! defined( 'SIGN_SELECTOR_VERSION' ) ) {
            define( 'SIGN_SELECTOR_VERSION', '1.0.4' );
        }
        if ( ! defined( 'SIGN_SELECTOR_URL' ) ) {
            define( 'SIGN_SELECTOR_URL', plugin_dir_url( __FILE__ ) );
        }
        if ( ! defined( 'SIGN_SELECTOR_PATH' ) ) {
            define( 'SIGN_SELECTOR_PATH', plugin_dir_path( __FILE__ ) );
        }
        if ( ! defined( 'SIGN_SELECTOR_DEV_MODE' ) ) {
            define( 'SIGN_SELECTOR_DEV_MODE', false );
        }

        // Admin settings
        $this->admin = new Sign_Selector_Admin();

        add_action( 'init', array( $this, 'init' ) ); 
    } 
    public function init() {
        add_action( 'wp_enqueue_scripts', [ $this, 'register_assets' ] );
        add_filter( 'script_loader_tag', [ $this, 'tf_loadScriptAsModule' ], 10, 3 );
        add_shortcode( 'sign_selector', [ $this, 'render_shortcode' ] );
        add_action( 'wp_ajax_sign_selector_save_configuration', [ $this, 'handle_save_configuration' ] );
        add_action( 'wp_ajax_nopriv_sign_selector_save_configuration', [ $this, 'handle_save_configuration' ] );

        if ( class_exists( 'WooCommerce' ) ) {
            add_filter( 'woocommerce_get_item_data', [ $this, 'render_cart_item_meta' ], 10, 2 );
            add_action( 'woocommerce_before_calculate_totals', [ $this, 'apply_sign_selector_cart_price' ], 20 );
            add_action( 'woocommerce_checkout_create_order_line_item', [ $this, 'add_order_item_meta' ], 10, 4 );
            add_filter( 'woocommerce_checkout_cart_item_quantity', [ $this, 'remove_checkout_item_quantity' ], 10, 3 );
            add_filter( 'woocommerce_default_address_fields', [ $this, 'rename_checkout_address_fields' ] );
            add_filter( 'woocommerce_get_country_locale', [ $this, 'override_country_locale_fields' ] );
        }
    }

    public function tf_loadScriptAsModule( $tag, $handle, $src ) {
        if ( ! in_array( $handle, array( 'sign-selector-vite-client', 'tf-core-sign-selector' ), true ) ) {
            return $tag;
        }
        $tag = '<script type="module" src="' . esc_url( $src ) . '"></script>';
        return $tag;
        
    }

    public function register_assets() {
        // Always register select2 (depends on jQuery, loads in footer)
        wp_register_script(
            'sign-selector-select2',
            SIGN_SELECTOR_URL . 'assets/select2.min.js',
            array( 'jquery' ),
            '4.1.0',
            true
        );

        if ( $this->should_use_dev_server() ) {
            $vite_server = $this->get_vite_server_url();

            wp_register_script( 'sign-selector-vite-client', $vite_server . '/@vite/client', array(), SIGN_SELECTOR_VERSION, true );
            wp_register_script( 'tf-core-sign-selector', $vite_server . '/src/main.js', array( 'sign-selector-vite-client', 'sign-selector-select2' ), SIGN_SELECTOR_VERSION, true );

            return;
        }

        $manifest = $this->get_manifest();
        if ( ! is_array( $manifest ) || empty( $manifest['src/main.js']['file'] ) ) {
            return;
        }

        $entry = $manifest['src/main.js'];
        wp_register_script(
            'tf-core-sign-selector',
            SIGN_SELECTOR_URL . 'build/' . ltrim( $entry['file'], '/' ),
            array( 'sign-selector-select2' ),
            SIGN_SELECTOR_VERSION,
            true
        );

        if ( ! empty( $entry['css'] ) && is_array( $entry['css'] ) ) {
            foreach ( $entry['css'] as $index => $css_file ) {
                wp_register_style(
                    'tf-core-sign-selector-style-' . (int) $index,
                    SIGN_SELECTOR_URL . 'build/' . ltrim( $css_file, '/' ),
                    array(),
                    SIGN_SELECTOR_VERSION,
                    'all'
                );
            }
        }
    }

    public function render_shortcode() {
        if ( is_singular() ) {
            $selector_page_url = get_permalink();
            if ( is_string( $selector_page_url ) && ! empty( $selector_page_url ) ) {
                update_option( 'sign_selector_page_url', esc_url_raw( $selector_page_url ), false );
            }
        }

        $this->localize_frontend_data();
        wp_enqueue_script( 'tf-core-sign-selector' );

        if ( ! $this->should_use_dev_server() ) {
            $manifest = $this->get_manifest();
            if ( is_array( $manifest ) && ! empty( $manifest['src/main.js']['css'] ) && is_array( $manifest['src/main.js']['css'] ) ) {
                foreach ( $manifest['src/main.js']['css'] as $index => $css_file ) {
                    wp_enqueue_style( 'tf-core-sign-selector-style-' . (int) $index );
                }
            }
        }

        return '<div class="sign-selector-app"></div>';
    }

    /**
     * Pass AJAX config to the frontend app.
     */
    private function localize_frontend_data() {
        $edit_context = $this->get_edit_context();
        $configurator_data = $this->admin->get_frontend_data();

        wp_localize_script(
            'tf-core-sign-selector',
            'SIGN_SELECTOR_CONFIG',
            array(
                'ajaxUrl' => admin_url( 'admin-ajax.php' ),
                'plugin_directory_url' => SIGN_SELECTOR_URL,
                'action'  => 'sign_selector_save_configuration',
                'nonce'   => wp_create_nonce( 'sign_selector_nonce' ),
                'cartUrl' => function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : '',
                'editCartItemKey' => $edit_context['editCartItemKey'],
                'initialConfiguration' => $edit_context['initialConfiguration'],
                'configurator' => $configurator_data,
            )
        );
    }

    /**
     * Receive sign configuration object from frontend.
     */
    public function handle_save_configuration() {
        check_ajax_referer( 'sign_selector_nonce', 'nonce' );

        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'WC' ) ) {
            wp_send_json_error(
                array(
                    'message' => __( 'WooCommerce is required for this action.', 'sign-selector' ),
                ),
                400
            );
        }

        $this->ensure_cart_loaded();

        if ( ! WC()->cart ) {
            wp_send_json_error(
                array(
                    'message' => __( 'Could not initialize the WooCommerce cart session.', 'sign-selector' ),
                ),
                400
            );
        }

        $raw_configuration = isset( $_POST['configuration'] ) ? wp_unslash( $_POST['configuration'] ) : '';
        $decoded           = is_string( $raw_configuration ) ? json_decode( $raw_configuration, true ) : array();

        if ( ! is_array( $decoded ) ) {
            wp_send_json_error(
                array(
                    'message' => __( 'Invalid configuration payload.', 'sign-selector' ),
                ),
                400
            );
        }

        $configuration = $this->sanitize_configuration_data( $decoded );

        $preview_image_url = $this->get_preview_image_url_from_configuration( $configuration );
        if ( '' !== $preview_image_url ) {
            $configuration['checkout']['previewImageUrl'] = $preview_image_url;
        }

        if ( isset( $configuration['checkout']['previewImageDataUrl'] ) ) {
            unset( $configuration['checkout']['previewImageDataUrl'] );
        }

        $validation_error = $this->get_validation_error_message( $configuration );
        if ( '' !== $validation_error ) {
            wp_send_json_error(
                array(
                    'message' => $validation_error,
                ),
                422
            );
        }

        $product_id = $this->get_or_create_sign_product_id( $configuration );
        if ( ! $product_id ) {
            wp_send_json_error(
                array(
                    'message' => __( 'Could not prepare sign product for cart.', 'sign-selector' ),
                ),
                500
            );
        }

        $edit_key = isset( $configuration['checkout']['editCartItemKey'] ) ? sanitize_text_field( $configuration['checkout']['editCartItemKey'] ) : '';
        $quantity = 1;

        if ( ! empty( $edit_key ) ) {
            $current_cart = WC()->cart->get_cart();
            if ( isset( $current_cart[ $edit_key ] ) ) {
                $quantity = max( 1, (int) $current_cart[ $edit_key ]['quantity'] );
                WC()->cart->remove_cart_item( $edit_key );
            }
        }

        unset( $configuration['checkout']['previewImagePath'] );

        $cart_item_data = array(
            'sign_selector_configuration' => $configuration,
            'sign_selector_unique_key'    => md5( wp_json_encode( $configuration ) . microtime( true ) ),
        );

        $cart_item_key = WC()->cart->add_to_cart( $product_id, $quantity, 0, array(), $cart_item_data );

        if ( ! $cart_item_key ) {
            $wc_notices = wc_get_notices( 'error' );
            wc_clear_notices();
            $notice_msg = '';
            if ( ! empty( $wc_notices ) ) {
                $notice_msg = wp_strip_all_tags( $wc_notices[0]['notice'] ?? ( is_string( $wc_notices[0] ) ? $wc_notices[0] : '' ) );
            }
            wp_send_json_error(
                array(
                    'message' => $notice_msg ? $notice_msg : __( 'Could not add sign configuration to cart.', 'sign-selector' ),
                ),
                500
            );
        }

        wp_send_json_success(
            array(
                'message'       => __( 'Configuration added to cart.', 'sign-selector' ),
                'configuration' => $configuration,
                'cartItemKey'   => $cart_item_key,
                'cartUrl'       => function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : '',
            )
        );
    }

    /**
     * Show sign configuration info under cart item rows.
     *
     * @param array<string,mixed> $item_data Item metadata rows.
     * @param array<string,mixed> $cart_item Cart item.
     * @return array<string,mixed>
     */
    public function render_cart_item_meta( $item_data, $cart_item ) {
        if ( empty( $cart_item['sign_selector_configuration'] ) || ! is_array( $cart_item['sign_selector_configuration'] ) ) {
            return $item_data;
        }

        $config = $cart_item['sign_selector_configuration'];

        $meta_map = array(
            __( 'Top Text', 'sign-selector' ) => $config['checkout']['topText'] ?? '',
            __( 'House Number', 'sign-selector' ) => $config['checkout']['houseNumber'] ?? '',
            __( 'Bottom Text', 'sign-selector' ) => $config['checkout']['bottomText'] ?? '',
            __( 'Sign Style', 'sign-selector' ) => $config['sign']['style']['label'] ?? '',
            __( 'Shape', 'sign-selector' ) => $config['sign']['shape']['label'] ?? '',
            __( 'Slate', 'sign-selector' ) => $config['sign']['slateColor']['label'] ?? '',
            __( 'Template', 'sign-selector' ) => $config['sign']['template']['label'] ?? '',
            __( 'Paint', 'sign-selector' ) => $config['sign']['paintColor']['label'] ?? '',
            __( 'Add-on', 'sign-selector' ) => $config['sign']['addOn']['label'] ?? '',
            __( 'Hardware', 'sign-selector' ) => $config['sign']['hardware']['label'] ?? '',
            __( 'Proof Required', 'sign-selector' ) => ! empty( $config['checkout']['requireProof'] ) ? 'Yes' : 'No',
        );

        foreach ( $meta_map as $label => $value ) {
            if ( '' === (string) $value ) {
                continue;
            }

            $item_data[] = array(
                'name'  => $label,
                'value' => wp_kses_post( $value ),
            );
        }

        if ( ! empty( $config['checkout']['previewImageUrl'] ) ) {
            $item_data[] = array(
                'name'  => __( 'Preview', 'sign-selector' ),
                'value' => sprintf(
                    '<img src="%1$s" alt="%2$s" style="max-width:120px;height:auto;border-radius:6px;display:block;" />',
                    esc_url( $config['checkout']['previewImageUrl'] ),
                    esc_attr__( 'Selected design template preview', 'sign-selector' )
                ),
            );
        }

        return $item_data;
    }

    /**
     * Apply custom line item price from the submitted configuration total.
     *
     * @param WC_Cart $cart WooCommerce cart object.
     * @return void
     */
    public function apply_sign_selector_cart_price( $cart ) {
        if ( is_admin() && ! defined( 'DOING_AJAX' ) ) {
            return;
        }

        if ( ! $cart || ! method_exists( $cart, 'get_cart' ) ) {
            return;
        }

        foreach ( $cart->get_cart() as $cart_item ) {
            if ( empty( $cart_item['sign_selector_configuration']['pricing']['total'] ) || empty( $cart_item['data'] ) ) {
                continue;
            }

            $price = (float) $cart_item['sign_selector_configuration']['pricing']['total'];
            if ( $price > 0 ) {
                $cart_item['data']->set_price( $price );
            }
        }
    }

    /**
     * Persist sign metadata to order items.
     *
     * @param WC_Order_Item_Product $item Order item.
     * @param string                $cart_item_key Cart item key.
     * @param array<string,mixed>   $values Cart values.
     * @param WC_Order              $order Order.
     * @return void
     */
    public function add_order_item_meta( $item, $cart_item_key, $values, $order ) {
        if ( empty( $values['sign_selector_configuration'] ) || ! is_array( $values['sign_selector_configuration'] ) ) {
            return;
        }

        $config = $values['sign_selector_configuration'];

        $meta_map = array(
            __( 'Top Text', 'sign-selector' ) => $config['checkout']['topText'] ?? '',
            __( 'House Number', 'sign-selector' ) => $config['checkout']['houseNumber'] ?? '',
            __( 'Bottom Text', 'sign-selector' ) => $config['checkout']['bottomText'] ?? '',
            __( 'Sign Style', 'sign-selector' ) => $config['sign']['style']['label'] ?? '',
            __( 'Shape', 'sign-selector' ) => $config['sign']['shape']['label'] ?? '',
            __( 'Slate', 'sign-selector' ) => $config['sign']['slateColor']['label'] ?? '',
            __( 'Template', 'sign-selector' ) => $config['sign']['template']['label'] ?? '',
            __( 'Paint', 'sign-selector' ) => $config['sign']['paintColor']['label'] ?? '',
            __( 'Add-on', 'sign-selector' ) => $config['sign']['addOn']['label'] ?? '',
            __( 'Hardware', 'sign-selector' ) => $config['sign']['hardware']['label'] ?? '',
            __( 'Proof Required', 'sign-selector' ) => ! empty( $config['checkout']['requireProof'] ) ? 'Yes' : 'No',
        );

        foreach ( $meta_map as $label => $value ) {
            if ( '' === (string) $value ) {
                continue;
            }

            $item->add_meta_data( $label, wp_kses_post( $value ) );
        }

        if ( ! empty( $config['checkout']['previewImageUrl'] ) ) {
            $item->add_meta_data(
                __( 'Preview', 'sign-selector' ),
                sprintf(
                    '<img src="%1$s" alt="%2$s" style="max-width:120px;height:auto;border-radius:6px;display:block;" />',
                    esc_url( $config['checkout']['previewImageUrl'] ),
                    esc_attr__( 'Selected design template preview', 'sign-selector' )
                )
            );
        }

        // Keep technical keys hidden from customer/admin order item meta views.
        $item->add_meta_data( '_sign_selector_cart_item_key', $cart_item_key );
    }

    public function append_edit_item_link( $item_name, $cart_item, $cart_item_key ) {
        if ( empty( $cart_item['sign_selector_configuration'] ) ) {
            return $item_name;
        }

        $selector_page_url = $this->get_selector_page_url();
        if ( empty( $selector_page_url ) ) {
            return $item_name;
        }

        $edit_url = add_query_arg( 'sign_selector_edit_item', rawurlencode( $cart_item_key ), $selector_page_url );

        return sprintf(
            '<a href="%1$s" class="sign-selector-edit-item-link" style="font-weight: 600;">%2$s</a>',
            esc_url( $edit_url ),
            esc_html__( 'Edit item', 'sign-selector' )
        );
    }

    /**
     * Remove the item quantity text (e.g. "x 1") from the checkout page for configurator products.
     *
     * @param string              $quantity_html Existing quantity HTML.
     * @param array<string,mixed> $cart_item Cart item data.
     * @param string              $cart_item_key Cart key.
     * @return string
     */
    public function remove_checkout_item_quantity( $quantity_html, $cart_item, $cart_item_key ) {
        if ( ! empty( $cart_item['sign_selector_configuration'] ) ) {
            return '';
        }

        return $quantity_html;
    }

    /**
     * Rename default checkout address fields.
     */
    public function rename_checkout_address_fields( $fields ) {
        if ( isset( $fields['state'] ) ) {
            $fields['state']['label'] = __( 'Province/State', 'sign-selector' );
        }
        if ( isset( $fields['postcode'] ) ) {
            $fields['postcode']['label'] = __( 'Postal Code/ ZIP', 'sign-selector' );
        }
        return $fields;
    }

    /**
     * Ensure country-specific locales don't override our custom labels.
     */
    public function override_country_locale_fields( $locales ) {
        foreach ( $locales as $country => $fields ) {
            if ( isset( $locales[ $country ]['state'] ) && isset( $locales[ $country ]['state']['label'] ) ) {
                $locales[ $country ]['state']['label'] = __( 'Province/State', 'sign-selector' );
            }
            if ( isset( $locales[ $country ]['postcode'] ) && isset( $locales[ $country ]['postcode']['label'] ) ) {
                $locales[ $country ]['postcode']['label'] = __( 'Postal Code/ ZIP', 'sign-selector' );
            }
        }
        
        if ( ! isset( $locales['US'] ) ) {
            $locales['US'] = array();
        }
        $locales['US']['state']['label']    = __( 'Province/State', 'sign-selector' );
        $locales['US']['postcode']['label'] = __( 'Postal Code/ ZIP', 'sign-selector' );
        
        if ( ! isset( $locales['CA'] ) ) {
            $locales['CA'] = array();
        }
        $locales['CA']['state']['label']    = __( 'Province/State', 'sign-selector' );
        $locales['CA']['postcode']['label'] = __( 'Postal Code/ ZIP', 'sign-selector' );

        return $locales;
    }

    /**
     * Sanitize nested arrays from the frontend configuration object.
     *
     * @param mixed $value Value to sanitize.
     * @return mixed
     */
    private function sanitize_configuration_data( $value ) {
        if ( is_array( $value ) ) {
            $sanitized = array();

            foreach ( $value as $key => $item ) {
                $safe_key              = is_string( $key ) ? preg_replace( '/[^a-zA-Z0-9_\-]/', '', $key ) : $key;
                $sanitized[ $safe_key ] = $this->sanitize_configuration_data( $item );
            }

            return $sanitized;
        }

        if ( is_string( $value ) ) {
            return sanitize_text_field( $value );
        }

        if ( is_int( $value ) || is_float( $value ) || is_bool( $value ) || is_null( $value ) ) {
            return $value;
        }

        return '';
    }

    /**
     * Ensure a cart instance exists for guest and authenticated users.
     *
     * @return void
     */
    private function ensure_cart_loaded() {
        if ( function_exists( 'wc_load_cart' ) ) {
            wc_load_cart();
        }
    }

    /**
     * Validate required payload fields before adding to cart.
     *
     * @param array<string,mixed> $configuration Frontend payload.
     * @return bool
     */
    private function is_valid_configuration( $configuration ) {
        return '' === $this->get_validation_error_message( $configuration );
    }

    /**
     * Return first validation error message for cart submission.
     * Empty string means configuration is valid.
     *
     * @param array<string,mixed> $configuration Frontend payload.
     * @return string
     */
    private function get_validation_error_message( $configuration ) {
        if ( empty( $configuration['sign']['style']['id'] ) ) {
            return __( 'Please select a sign style to continue.', 'sign-selector' );
        }

        $flow = isset( $configuration['sign']['style']['flow'] ) && is_array( $configuration['sign']['style']['flow'] )
            ? $configuration['sign']['style']['flow']
            : array();

        $requires_shape = empty( $flow ) || in_array( 'size-shape', $flow, true );
        if ( $requires_shape && empty( $configuration['sign']['shape']['id'] ) ) {
            return __( 'Please select a size & shape to continue.', 'sign-selector' );
        }

        if ( in_array( 'design-template', $flow, true ) && empty( $configuration['sign']['template']['id'] ) ) {
            return __( 'Please select a design template to continue.', 'sign-selector' );
        }

        if ( in_array( 'slate-color', $flow, true ) && empty( $configuration['sign']['slateColor']['id'] ) ) {
            return __( 'Please select a slate color to continue.', 'sign-selector' );
        }

        if ( in_array( 'paint-color', $flow, true ) && empty( $configuration['sign']['paintColor']['id'] ) ) {
            return __( 'Please select a paint color to continue.', 'sign-selector' );
        }

        if ( empty( $configuration['pricing']['total'] ) || (float) $configuration['pricing']['total'] <= 0 ) {
            return __( 'Please complete the required sign options before adding to cart.', 'sign-selector' );
        }

        $required_fields = $this->get_required_checkout_fields( $configuration );
        $field_labels    = array(
            'firstLine'   => __( 'First Line of Text', 'sign-selector' ),
            'secondLine'  => __( 'Second Line of Text', 'sign-selector' ),
            'topText'     => __( 'Top Text', 'sign-selector' ),
            'houseNumber' => __( 'House Number', 'sign-selector' ),
            'bottomText'  => __( 'Bottom Text', 'sign-selector' ),
        );

        foreach ( $required_fields as $lookup_key ) {
            $value = isset( $configuration['checkout'][ $lookup_key ] ) ? trim( (string) $configuration['checkout'][ $lookup_key ] ) : '';

            if ( '' === $value ) {
                $label = isset( $field_labels[ $lookup_key ] ) ? $field_labels[ $lookup_key ] : __( 'A required field', 'sign-selector' );
                return sprintf( __( '%s is required.', 'sign-selector' ), $label );
            }
        }

        return '';
    }

    /**
     * Determine required checkout text fields from template metadata.
     *
     * @param array<string,mixed> $configuration Frontend payload.
     * @return array<int,string>
     */
    private function get_required_checkout_fields( $configuration ) {
        $required_fields = array();

        if ( isset( $configuration['sign']['template']['fields'] ) && is_array( $configuration['sign']['template']['fields'] ) ) {
            $required_fields = $configuration['sign']['template']['fields'];
        } elseif ( ! empty( $configuration['sign']['template']['textLayout'] ) && is_string( $configuration['sign']['template']['textLayout'] ) ) {
            $layout = strtolower( sanitize_text_field( $configuration['sign']['template']['textLayout'] ) );

            if ( in_array( $layout, array( 'top-number-bottom', 'top_house_bottom', 'full' ), true ) ) {
                $required_fields = array( 'topText', 'houseNumber', 'bottomText' );
            } elseif ( in_array( $layout, array( 'number-bottom', 'number_and_bottom' ), true ) ) {
                $required_fields = array( 'houseNumber', 'bottomText' );
            } elseif ( 'number' === $layout ) {
                $required_fields = array( 'houseNumber' );
            } elseif ( 'two-lines' === $layout ) {
                $required_fields = array( 'firstLine', 'secondLine' );
            } elseif ( 'one-line' === $layout ) {
                $required_fields = array( 'firstLine' );
            }
        }

        if ( empty( $required_fields ) ) {
            $required_fields = array( 'houseNumber', 'bottomText' );
        }

        $normalized = array();

        foreach ( $required_fields as $field_key ) {
            $lookup_key = $this->normalize_required_checkout_field_key( $field_key );

            if ( '' === $lookup_key || in_array( $lookup_key, $normalized, true ) ) {
                continue;
            }

            $normalized[] = $lookup_key;
        }

        return $normalized;
    }

    /**
     * Normalize template field aliases to checkout payload keys.
     *
     * @param string $field_key Raw field key.
     * @return string
     */
    private function normalize_required_checkout_field_key( $field_key ) {
        $normalized_key = strtolower( trim( (string) $field_key ) );

        if ( in_array( $normalized_key, array( 'first', 'firstline', 'first_line', 'line1', 'line_1' ), true ) ) {
            return 'firstLine';
        }

        if ( in_array( $normalized_key, array( 'second', 'secondline', 'second_line', 'line2', 'line_2' ), true ) ) {
            return 'secondLine';
        }

        if ( in_array( $normalized_key, array( 'top', 'toptext', 'top_text', 'header', 'title' ), true ) ) {
            return 'topText';
        }

        if ( in_array( $normalized_key, array( 'number', 'house', 'housenumber', 'house_number', 'address' ), true ) ) {
            return 'houseNumber';
        }

        if ( in_array( $normalized_key, array( 'bottom', 'bottomtext', 'bottom_text', 'street', 'footer', 'subtitle' ), true ) ) {
            return 'bottomText';
        }

        return '';
    }

    /**
     * Resolve preview image URL for metadata display.
     * Priority: explicit checkout URL, then selected template image URL.
     *
     * @param array<string,mixed> $configuration Frontend payload.
     * @return string
     */
    private function get_preview_image_url_from_configuration( $configuration ) {
        if ( ! is_array( $configuration ) ) {
            return '';
        }

        $checkout_preview = isset( $configuration['checkout']['previewImageUrl'] ) && is_string( $configuration['checkout']['previewImageUrl'] )
            ? trim( $configuration['checkout']['previewImageUrl'] )
            : '';

        if ( '' !== $checkout_preview ) {
            return esc_url_raw( $checkout_preview );
        }

        $template_preview = isset( $configuration['sign']['template']['imageUrl'] ) && is_string( $configuration['sign']['template']['imageUrl'] )
            ? trim( $configuration['sign']['template']['imageUrl'] )
            : '';

        if ( '' !== $template_preview ) {
            return esc_url_raw( $template_preview );
        }

        return '';
    }

    /**
     * Build style-specific product details from a submitted configuration.
     *
     * @param array<string,mixed> $configuration Frontend payload.
     * @return array<string,string>
     */
    private function get_sign_product_context( $configuration = array() ) {
        $style_label = '';
        $style_description = '';
        $style_id    = '';

        if ( ! empty( $configuration['sign']['style']['label'] ) && is_string( $configuration['sign']['style']['label'] ) ) {
            $style_label = sanitize_text_field( $configuration['sign']['style']['label'] );
        }
        if ( ! empty( $configuration['sign']['style']['description'] ) && is_string( $configuration['sign']['style']['description'] ) ) {
            $style_description = sanitize_text_field( $configuration['sign']['style']['description'] );
        }

        if ( ! empty( $configuration['sign']['style']['id'] ) && is_string( $configuration['sign']['style']['id'] ) ) {
            $style_id = sanitize_key( $configuration['sign']['style']['id'] );
        }

        if ( '' === $style_label ) {
            $style_label = __( 'Custom Sign Configuration', 'sign-selector' );
        }

        $style_key = sanitize_title( $style_label );
        if ( '' === $style_key ) {
            $style_key = $style_id ? $style_id : 'default';
        }

        return array(
            'style_key'    => $style_key,
            'style_label'  => $style_label,
            'product_name' => $style_label,
            'product_description' => $style_description,
        );
    }

    /**
     * Find an existing hidden placeholder product for a style.
     *
     * @param string $style_key Sanitized style key.
     * @return int
     */
    private function find_existing_sign_product_id( $style_key ) {
        $posts = get_posts(
            array(
                'post_type'      => 'product',
                'post_status'    => array( 'publish', 'private', 'draft' ),
                'posts_per_page' => 1,
                'fields'         => 'ids',
                'meta_query'     => array(
                    array(
                        'key'   => '_sign_selector_product',
                        'value' => 'yes',
                    ),
                    array(
                        'key'   => '_sign_selector_style_key',
                        'value' => $style_key,
                    ),
                ),
            )
        );

        return ! empty( $posts[0] ) ? (int) $posts[0] : 0;
    }

    /**
     * Get or create a hidden product for custom sign cart items.
     * Reuses a single product for each sign style.
     *
     * @param array<string,mixed> $configuration Frontend payload.
     * @return int
     */
    private function get_or_create_sign_product_id( $configuration = array() ) {
        $context      = $this->get_sign_product_context( $configuration );
        $style_key    = $context['style_key'];
        $product_name = $context['product_name'];
        $product_description = $context['product_description'];

        $product_map = get_option( 'sign_selector_product_ids', array() );
        if ( ! is_array( $product_map ) ) {
            $product_map = array();
        }

        $stored_id = isset( $product_map[ $style_key ] ) ? (int) $product_map[ $style_key ] : 0;
        if ( $stored_id > 0 ) {
            $product = wc_get_product( $stored_id );
            if ( $product instanceof WC_Product && $product->is_purchasable() && 'publish' === $product->get_status() ) {
                if ( $product->get_name() !== $product_name ) {
                    $product->set_name( $product_name );
                    $product->save();
                }

                return $stored_id;
            }

            unset( $product_map[ $style_key ] );
            update_option( 'sign_selector_product_ids', $product_map, false );
        }

        $existing_id = $this->find_existing_sign_product_id( $style_key );
        if ( $existing_id > 0 ) {
            $product = wc_get_product( $existing_id );
            if ( $product instanceof WC_Product && 'publish' === $product->get_status() ) {
                if ( $product->get_name() !== $product_name ) {
                    $product->set_name( $product_name );
                    $product->save();
                }

                $product_map[ $style_key ] = $existing_id;
                update_option( 'sign_selector_product_ids', $product_map, false );
                update_option( 'sign_selector_product_id', $existing_id, false );

                return $existing_id;
            }
        }

        $product = new WC_Product_Simple();
        $product->set_name( $product_name );
        $product->set_status( 'publish' );
        $product->set_catalog_visibility( 'hidden' );
        $product->set_virtual( true );
        $product->set_regular_price( '1' );
        $product->set_price( '1' );
        $product->set_description( $product_description );
        $product->update_meta_data( '_sign_selector_product', 'yes' );
        $product->update_meta_data( '_sign_selector_style_key', $style_key );
        $product->update_meta_data( '_sign_selector_style_label', $context['style_label'] );

        $product_id = $product->save();
        if ( $product_id ) {
            $product_map[ $style_key ] = (int) $product_id;
            update_option( 'sign_selector_product_ids', $product_map, false );
            update_option( 'sign_selector_product_id', (int) $product_id, false );
        }

        return (int) $product_id;
    }

    /**
     * Resolve selector page URL for edit-item links.
     *
     * @return string
     */
    private function get_selector_page_url() {
        $stored_url = get_option( 'sign_selector_page_url', '' );

        return is_string( $stored_url ) ? $stored_url : '';
    }

    /**
     * Load editable cart-item payload when user opens selector from cart edit link.
     *
     * @return array<string,mixed>
     */
    private function get_edit_context() {
        $context = array(
            'editCartItemKey' => '',
            'initialConfiguration' => array(),
        );

        $raw_key = isset( $_GET['sign_selector_edit_item'] ) ? wp_unslash( $_GET['sign_selector_edit_item'] ) : '';
        $cart_item_key = sanitize_text_field( $raw_key );

        if ( empty( $cart_item_key ) || ! class_exists( 'WooCommerce' ) || ! function_exists( 'WC' ) ) {
            return $context;
        }

        $this->ensure_cart_loaded();

        if ( ! WC()->cart ) {
            return $context;
        }

        $cart_contents = WC()->cart->get_cart();
        if ( empty( $cart_contents[ $cart_item_key ]['sign_selector_configuration'] ) ) {
            return $context;
        }

        $context['editCartItemKey'] = $cart_item_key;
        $context['initialConfiguration'] = $cart_contents[ $cart_item_key ]['sign_selector_configuration'];

        return $context;
    }

    /**
     * Save base64 preview image to uploads/tf-sign-selector.
     *
     * @param string $preview_data_url Base64 image string.
     * @param string $preview_name Optional file name from frontend.
     * @return array<string,string>
     */
    private function save_preview_image( $preview_data_url, $preview_name = '' ) {
        $result = array(
            'path' => '',
            'url'  => '',
        );

        if ( empty( $preview_data_url ) || ! is_string( $preview_data_url ) ) {
            return $result;
        }

        if ( 0 !== strpos( $preview_data_url, 'data:image/' ) ) {
            return $result;
        }

        if ( ! preg_match( '/^data:image\/(png|jpe?g);base64,(.+)$/', $preview_data_url, $matches ) ) {
            return $result;
        }

        $extension = 'jpeg' === $matches[1] ? 'jpg' : $matches[1];
        $binary    = base64_decode( str_replace( ' ', '+', $matches[2] ) );

        if ( false === $binary ) {
            return $result;
        }

        $uploads = wp_upload_dir();
        if ( ! empty( $uploads['error'] ) ) {
            return $result;
        }

        $target_dir = trailingslashit( $uploads['basedir'] ) . 'tf-sign-selector';
        if ( ! wp_mkdir_p( $target_dir ) ) {
            return $result;
        }

        $base_name = ! empty( $preview_name ) ? sanitize_file_name( pathinfo( $preview_name, PATHINFO_FILENAME ) ) : 'sign-preview';
        if ( empty( $base_name ) ) {
            $base_name = 'sign-preview';
        }

        $file_name = sprintf( '%1$s-%2$s.%3$s', $base_name, wp_generate_password( 8, false, false ), $extension );
        $file_path = trailingslashit( $target_dir ) . $file_name;

        if ( false === file_put_contents( $file_path, $binary ) ) {
            return $result;
        }

        $result['path'] = $file_path;
        $result['url']  = trailingslashit( $uploads['baseurl'] ) . 'tf-sign-selector/' . $file_name;

        return $result;
    }

    /**
     * Read Vite manifest for production assets.
     *
     * @return array<string, mixed>
     */
    private function get_manifest() {
        $manifest_path = SIGN_SELECTOR_PATH . 'build/.vite/manifest.json';

        if ( ! file_exists( $manifest_path ) ) {
            return array();
        }

        $manifest = json_decode( file_get_contents( $manifest_path ), true );

        return is_array( $manifest ) ? $manifest : array();
    }

    /**
     * Resolve Vite dev server base URL.
     *
     * @return string
     */
    private function get_vite_server_url() {
        $default = 'http://localhost:5173';

        return untrailingslashit( apply_filters( 'sign_selector_vite_server_url', $default ) );
    }

    /**
     * Use dev server only when mode is enabled and protocol is compatible.
     *
     * @return bool
     */
    private function should_use_dev_server() {
        if ( ! ( defined( 'SIGN_SELECTOR_DEV_MODE' ) && true === SIGN_SELECTOR_DEV_MODE ) ) {
            return false;
        }

        $vite_server = $this->get_vite_server_url();

        // Avoid mixed-content/CORS failures on SSL pages when Vite runs on HTTP.
        if ( is_ssl() && 0 !== strpos( $vite_server, 'https://' ) ) {
            return false;
        }

        return true;
    }

    // public function render_app_container() {
    //     echo '<div id="sign-selector-app">
    //     asdfasdf</div>';
    // }
}

new SignSelector();

