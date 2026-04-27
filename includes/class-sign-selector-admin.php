<?php
/**
 * Sign Selector Admin – manages all configurator options.
 *
 * Stores data in wp_options as JSON arrays. Every item carries an `enabled`
 * flag so items can be toggled without deleting them.
 *
 * @package SignSelector
 */

defined( 'ABSPATH' ) || exit;

class Sign_Selector_Admin {

    /** Option keys in wp_options */
    const OPT_STEPS              = 'sign_selector_steps';
    const OPT_SIGN_STYLES        = 'sign_selector_sign_styles';
    const OPT_SURFACES           = 'sign_selector_surfaces';
    const OPT_SHAPES             = 'sign_selector_shapes';
    const OPT_SLATE_COLORS       = 'sign_selector_slate_colors';
    const OPT_DESIGN_TEMPLATES   = 'sign_selector_design_templates';
    const OPT_PAINT_COLORS       = 'sign_selector_paint_colors';
    const OPT_ADDONS             = 'sign_selector_addons';
    const OPT_MOUNTING_HARDWARE  = 'sign_selector_mounting_hardware';

    /** REST namespace */
    const REST_NS = 'sign-selector/v1';

    /**
     * Canonical list of flow sections a sign style can include.
     * The key is the section id; the value is the human label shown in admin.
     */
    const FLOW_SECTIONS = array(
        'installation-surface' => 'Installation Surface',
        'size-shape'           => 'Size & Shape',
        'slate-color'          => 'Slate Color',
        'design-template'      => 'Design Template',
        'paint-color'          => 'Paint Color',
    );

    public function __construct() {
        add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
        add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
        // add_action( 'admin_init', array( $this, 'maybe_seed_defaults' ) );
    }

    /* ─── Admin menu ────────────────────────────────────────── */

    public function add_admin_menu() {
        add_menu_page(
            __( 'Sign Selector', 'sign-selector' ),
            __( 'Sign Selector', 'sign-selector' ),
            'manage_options',
            'sign-selector',
            array( $this, 'render_admin_page' ),
            'dashicons-art',
            58
        );
    }

    public function render_admin_page() {
        echo '<div id="sign-selector-admin-app"></div>';
    }

    public function enqueue_admin_assets( $hook ) {
        if ( 'toplevel_page_sign-selector' !== $hook ) {
            return;
        }

        wp_enqueue_media(); // WordPress media uploader

        wp_enqueue_style(
            'sign-selector-admin-css',
            SIGN_SELECTOR_URL . 'assets/admin/admin.css',
            array(),
            SIGN_SELECTOR_VERSION
        );

        wp_enqueue_script(
            'sign-selector-admin-js',
            SIGN_SELECTOR_URL . 'assets/admin/admin.js',
            array( 'wp-element', 'wp-components', 'wp-api-fetch', 'wp-i18n' ),
            SIGN_SELECTOR_VERSION,
            true
        );

        wp_localize_script(
            'sign-selector-admin-js',
            'SIGN_SELECTOR_ADMIN',
            array(
                'restBase'     => rest_url( self::REST_NS ),
                'nonce'        => wp_create_nonce( 'wp_rest' ),
                'pluginUrl'    => SIGN_SELECTOR_URL,
                'flowSections' => self::FLOW_SECTIONS,
            )
        );
    }

    /* ─── REST API ──────────────────────────────────────────── */

    public function register_rest_routes() {
        $collections = array(
            'steps'             => self::OPT_STEPS,
            'sign-styles'       => self::OPT_SIGN_STYLES,
            'surfaces'          => self::OPT_SURFACES,
            'shapes'            => self::OPT_SHAPES,
            'slate-colors'      => self::OPT_SLATE_COLORS,
            'design-templates'  => self::OPT_DESIGN_TEMPLATES,
            'paint-colors'      => self::OPT_PAINT_COLORS,
            'addons'            => self::OPT_ADDONS,
            'mounting-hardware' => self::OPT_MOUNTING_HARDWARE,
        );

        foreach ( $collections as $route => $option_key ) {
            // GET  /sign-selector/v1/{route}
            register_rest_route( self::REST_NS, '/' . $route, array(
                'methods'             => 'GET',
                'callback'            => function () use ( $option_key ) {
                    // Bypass any persistent object cache so live-server reads are always fresh.
                    wp_cache_delete( $option_key, 'options' );
                    return rest_ensure_response( $this->get_option_items( $option_key ) );
                },
                'permission_callback' => function () {
                    return current_user_can( 'manage_options' );
                },
            ) );

            // POST /sign-selector/v1/{route}  (full replacement save)
            register_rest_route( self::REST_NS, '/' . $route, array(
                'methods'             => 'POST',
                'callback'            => function ( WP_REST_Request $request ) use ( $option_key ) {
                    $items = $request->get_json_params();
                    if ( ! is_array( $items ) ) {
                        return new WP_Error( 'invalid_data', 'Expected a JSON array.', array( 'status' => 400 ) );
                    }
                    $sanitized = $this->sanitize_items( $items );
                    $encoded   = wp_json_encode( $sanitized );

                    update_option( $option_key, $encoded, false );

                    // Flush any persistent object cache entry so the next GET
                    // reads the value we just wrote, not a stale cached copy.
                    wp_cache_delete( $option_key, 'options' );

                    // Verify the write actually landed in the database.
                    $stored = get_option( $option_key );
                    if ( $stored !== $encoded ) {
                        return new WP_Error(
                            'save_failed',
                            'Data could not be persisted to the database.',
                            array( 'status' => 500 )
                        );
                    }

                    return rest_ensure_response( $sanitized );
                },
                'permission_callback' => function () {
                    return current_user_can( 'manage_options' );
                },
            ) );
        }
    }

    /* ─── Options helpers ───────────────────────────────────── */

    /**
     * Get an option's items as a PHP array.
     */
    public function get_option_items( $key ) {
        $raw = get_option( $key, '[]' );
        $arr = json_decode( $raw, true );
        return is_array( $arr ) ? $arr : array();
    }

    /**
     * Sanitize an array of items recursively.
     */
    private function sanitize_items( $items ) {
        $sanitized = array();

        foreach ( $items as $item ) {
            if ( ! is_array( $item ) ) {
                continue;
            }

            $clean = array();
            foreach ( $item as $key => $value ) {
                // Preserve camelCase keys – only strip dangerous characters.
                $safe_key = is_string( $key ) ? preg_replace( '/[^a-zA-Z0-9_\-]/', '', $key ) : $key;
                if ( is_array( $value ) ) {
                    $clean[ $safe_key ] = $this->sanitize_items( array( $value ) )[0] ?? array();
                } elseif ( is_bool( $value ) ) {
                    $clean[ $safe_key ] = $value;
                } elseif ( is_numeric( $value ) && ! is_string( $value ) ) {
                    // Native int / float from JSON decode.
                    $clean[ $safe_key ] = $value;
                } elseif ( is_string( $value ) && is_numeric( $value ) ) {
                    // Numeric string from form input – coerce to proper type.
                    $clean[ $safe_key ] = $value + 0;
                } elseif ( is_string( $value ) ) {
                    // Allow URLs through
                    if ( filter_var( $value, FILTER_VALIDATE_URL ) ) {
                        $clean[ $safe_key ] = esc_url_raw( $value );
                    } elseif ( $safe_key === 'icon' && strpos( trim( $value ), '<' ) === 0 ) {
                        // Allow inline SVG for the icon field.
                        $svg_allowed = array(
                            'svg'    => array( 'xmlns' => true, 'viewBox' => true, 'viewbox' => true, 'width' => true, 'height' => true, 'fill' => true, 'class' => true, 'style' => true, 'aria-hidden' => true ),
                            'path'   => array( 'd' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true, 'stroke-linecap' => true, 'stroke-linejoin' => true, 'fill-rule' => true, 'clip-rule' => true, 'opacity' => true ),
                            'circle' => array( 'cx' => true, 'cy' => true, 'r' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true ),
                            'rect'   => array( 'x' => true, 'y' => true, 'width' => true, 'height' => true, 'rx' => true, 'ry' => true, 'fill' => true, 'stroke' => true ),
                            'line'   => array( 'x1' => true, 'y1' => true, 'x2' => true, 'y2' => true, 'stroke' => true, 'stroke-width' => true ),
                            'polyline' => array( 'points' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true ),
                            'polygon'  => array( 'points' => true, 'fill' => true, 'stroke' => true ),
                            'g'      => array( 'fill' => true, 'stroke' => true, 'transform' => true, 'opacity' => true ),
                            'defs'   => array(),
                            'clipPath' => array( 'id' => true ),
                            'use'    => array( 'href' => true, 'xlink:href' => true ),
                        );
                        $clean[ $safe_key ] = wp_kses( $value, $svg_allowed );
                    } else {
                        $clean[ $safe_key ] = sanitize_text_field( $value );
                    }
                }
            }

            $sanitized[] = $clean;
        }

        return $sanitized;
    }

    /**
     * Build default design templates from bundled template assets.
     *
     * Expected structure:
     * assets/images/template/{shape}/{tier}/*.png
     *
     * @param string   $template_base_url Base URL to template image root.
     * @param string[] $all_sign_style_ids Available sign style ids.
     * @return array<int, array<string, mixed>>
     */
    private function build_default_design_templates( $template_base_url, $all_sign_style_ids ) {
        $template_root = trailingslashit( SIGN_SELECTOR_PATH ) . 'assets/images/template/';
        $shape_dirs = array( 'arch', 'oval', 'rectangle', 'round' );
        $tier_dirs  = array(
            'deluxe'  => 'Deluxe',
            'standard' => 'Standard',
        );

        $templates = array();

        foreach ( $shape_dirs as $shape_dir ) {
            foreach ( $tier_dirs as $tier_dir => $tier_label ) {
                $pattern = $template_root . $shape_dir . '/' . $tier_dir . '/*.png';
                $files   = glob( $pattern );

                if ( ! is_array( $files ) || empty( $files ) ) {
                    continue;
                }

                natsort( $files );

                foreach ( $files as $file_path ) {
                    $file_name = basename( $file_path );
                    $stem      = pathinfo( $file_name, PATHINFO_FILENAME );
                    $digits    = preg_replace( '/\D+/', '', $stem );
                    $suffix    = '' !== $digits ? str_pad( $digits, 2, '0', STR_PAD_LEFT ) : sanitize_title( $stem );

                    $templates[] = array(
                        'id'           => sprintf( 'tpl-%s-%s-%s', $shape_dir, $tier_dir, $suffix ),
                        'label'        => sprintf( '%s %s #%s', ucfirst( $shape_dir ), $tier_label, $suffix ),
                        'tier'         => $tier_label,
                        'shapeId'      => $shape_dir,
                        'signStyleIds' => $all_sign_style_ids,
                        'textLayout'   => 'number-bottom',
                        'fields'       => array( 'houseNumber', 'bottomText' ),
                        'price'        => 0,
                        'imageUrl'     => $template_base_url . rawurlencode( $shape_dir ) . '/' . rawurlencode( $tier_dir ) . '/' . rawurlencode( $file_name ),
                        'enabled'      => true,
                    );
                }
            }
        }

        return $templates;
    }

    /**
     * Build default installation surfaces from bundled image assets.
     *
     * @param string $surface_base_url Base URL to installation surface image root.
        * @param string[] $all_sign_style_ids Available sign style ids.
     * @return array<int, array<string, mixed>>
     */
        private function build_default_installation_surfaces( $surface_base_url, $all_sign_style_ids ) {
        $surface_root = trailingslashit( SIGN_SELECTOR_PATH ) . 'assets/images/installation-surface/';
        $files        = glob( $surface_root . '*' );
        $surfaces     = array();
        $index        = 1;

        if ( ! is_array( $files ) || empty( $files ) ) {
            return $surfaces;
        }

        $allowed_extensions = array( 'jpg', 'jpeg', 'png', 'webp' );
        $image_files        = array();

        foreach ( $files as $file_path ) {
            if ( ! is_file( $file_path ) ) {
                continue;
            }

            $extension = strtolower( (string) pathinfo( $file_path, PATHINFO_EXTENSION ) );

            if ( ! in_array( $extension, $allowed_extensions, true ) ) {
                continue;
            }

            $image_files[] = $file_path;
        }

        if ( empty( $image_files ) ) {
            return $surfaces;
        }

        natsort( $image_files );

        foreach ( $image_files as $file_path ) {
            $filename = basename( $file_path );
            $id       = sanitize_title( (string) pathinfo( $filename, PATHINFO_FILENAME ) );
            // file name without extension may be non-unique or empty after sanitization – fallback to generated id. 
            $file_label = ucwords( str_replace( array( '-', '_' ), ' ', pathinfo( $filename, PATHINFO_FILENAME ) ) );

            if ( '' === $id ) {
                $id = sprintf( 'surface-%02d', $index );
            }

            $surfaces[] = array(
                'id'       => $id,
                'label'    => $file_label,
                'image'    => $filename,
                'imageUrl' => $surface_base_url . rawurlencode( $filename ),
                'signStyleIds' => $all_sign_style_ids,
                'enabled'  => true,
            );

            $index++;
        }

        return $surfaces;
    }

    /* ─── Seed defaults on first activation ─────────────────── */

    public function maybe_seed_defaults() {
        // Re-seed when the data version changes.
        return;
        $current_version = '16';
        if ( get_option( 'sign_selector_seeded' ) === $current_version ) {
            return;
        }

        $plugin_url = SIGN_SELECTOR_URL;
        $surface_base  = $plugin_url . 'assets/images/installation-surface/';
        $slate_base    = $plugin_url . 'assets/images/slate/';
        $paint_base    = $plugin_url . 'assets/images/paint/';

        // Steps
        $steps = array(
            array( 'id' => 1, 'title' => 'Select Sign Style',   'heading' => 'Select a Sign Style',      'subheading' => 'Choose the purpose of your sign',                'enabled' => true ),
            array( 'id' => 2, 'title' => 'Shape, Size & Slate', 'heading' => 'Select Shape, Size & Slate','subheading' => 'Set the size and base material of your sign',     'enabled' => true ),
            array( 'id' => 3, 'title' => 'Design & Finish',     'heading' => 'Choose Design & Finish',    'subheading' => 'Select a layout and engraving color',             'enabled' => true ),
            array( 'id' => 4, 'title' => 'Review & Add',        'heading' => 'Review Your Sign',          'subheading' => 'Confirm details before adding to cart',           'enabled' => true ),
        );

        // Sign Styles – each style carries a `flow` array that defines the
        // configurator sections (and their order) the customer sees.
        $all_sections = array_keys( self::FLOW_SECTIONS );
        $sign_styles = array(
            array( 'id' => 'home-address',  'label' => 'Home Address',        'description' => 'For displaying your house number',      'icon' => '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 28V17.3333C20 16.9797 19.8595 16.6406 19.6095 16.3905C19.3594 16.1405 19.0203 16 18.6667 16H13.3333C12.9797 16 12.6406 16.1405 12.3905 16.3905C12.1405 16.6406 12 16.9797 12 17.3333V28M4 13.3333C3.99991 12.9454 4.08445 12.5622 4.24772 12.2103C4.41099 11.8584 4.64906 11.5464 4.94533 11.296L14.2787 3.29599C14.76 2.8892 15.3698 2.66602 16 2.66602C16.6302 2.66602 17.24 2.8892 17.7213 3.29599L27.0547 11.296C27.3509 11.5464 27.589 11.8584 27.7523 12.2103C27.9156 12.5622 28.0001 12.9454 28 13.3333V25.3333C28 26.0406 27.719 26.7188 27.219 27.2189C26.7189 27.719 26.0406 28 25.3333 28H6.66667C5.95942 28 5.28115 27.719 4.78105 27.2189C4.28095 26.7188 4 26.0406 4 25.3333V13.3333Z" stroke="#302F37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>', 'iconUrl' => '', 'enabled' => true, 'flow' => $all_sections ),
            array( 'id' => 'cottage',       'label' => 'Cottage',             'description' => 'Ideal for vacation homes',               'icon' => '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 29.3333V25.3333M22.6666 18.6667L26.6666 23.0667C26.8494 23.253 26.9734 23.4889 27.0233 23.7451C27.0732 24.0013 27.0468 24.2665 26.9475 24.5078C26.8481 24.7491 26.6801 24.956 26.4643 25.1027C26.2484 25.2495 25.9943 25.3297 25.7333 25.3333H6.26663C6.00566 25.3297 5.75151 25.2495 5.53568 25.1027C5.31985 24.956 5.15183 24.7491 5.05246 24.5078C4.95308 24.2665 4.92672 24.0013 4.97665 23.7451C5.02657 23.4889 5.15058 23.253 5.3333 23.0667L9.3333 18.6667H8.9333C8.67233 18.663 8.41818 18.5828 8.20235 18.4361C7.98651 18.2893 7.8185 18.0825 7.71912 17.8411C7.61975 17.5998 7.59339 17.3346 7.64331 17.0784C7.69323 16.8223 7.81724 16.5864 7.99997 16.4L12 12H11.7333C11.461 12.0246 11.1877 11.9648 10.9504 11.8288C10.7132 11.6928 10.5235 11.4872 10.4071 11.2398C10.2907 10.9924 10.2531 10.7151 10.2995 10.4457C10.346 10.1762 10.4741 9.92752 10.6666 9.73333L16 4L21.3333 9.73333C21.5258 9.92752 21.654 10.1762 21.7004 10.4457C21.7468 10.7151 21.7093 10.9924 21.5928 11.2398C21.4764 11.4872 21.2867 11.6928 21.0495 11.8288C20.8123 11.9648 20.539 12.0246 20.2666 12H20L24 16.4C24.1827 16.5864 24.3067 16.8223 24.3566 17.0784C24.4065 17.3346 24.3802 17.5998 24.2808 17.8411C24.1814 18.0825 24.0134 18.2893 23.7976 18.4361C23.5818 18.5828 23.3276 18.663 23.0666 18.6667H22.6666Z" stroke="#302F37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>', 'iconUrl' => '', 'enabled' => true, 'flow' => array( 'size-shape', 'slate-color', 'design-template', 'paint-color' ) ),
            array( 'id' => 'wine-cellar',   'label' => 'Wine Cellar Sign',    'description' => 'Label your cellar or tasting space',     'icon' => '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M10.6667 29.3332H21.3334M9.33337 13.3332H22.6667M9.33337 13.3332C9.33337 10.6665 10 7.99984 12 2.6665H20C22 7.99984 22.6667 10.6665 22.6667 13.3332M9.33337 13.3332C9.33337 15.1013 10.0358 16.797 11.286 18.0472C12.5362 19.2975 14.2319 19.9998 16 19.9998M22.6667 13.3332C22.6667 15.1013 21.9643 16.797 20.7141 18.0472C19.4638 19.2975 17.7682 19.9998 16 19.9998M16 19.9998V29.3332" stroke="#302F37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>', 'iconUrl' => '', 'enabled' => true, 'flow' => $all_sections ),
            array( 'id' => 'custom',        'label' => 'Something Custom',    'description' => 'Create a fully custom sign',             'icon' => '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16.8787 29.3332H24C24.7073 29.3332 25.3856 29.0522 25.8856 28.5521C26.3857 28.052 26.6667 27.3738 26.6667 26.6665V10.6665M26.6667 10.6665C26.6677 10.244 26.5851 9.82545 26.4235 9.43504C26.262 9.04463 26.0247 8.69008 25.7254 8.39185L20.9414 3.60785C20.6431 3.30854 20.2886 3.07126 19.8982 2.90969C19.5078 2.74813 19.0892 2.66548 18.6667 2.66651M26.6667 10.6665H20C19.6464 10.6665 19.3073 10.526 19.0572 10.276C18.8072 10.0259 18.6667 9.6868 18.6667 9.33318L18.6667 2.66651M18.6667 2.66651H8.00003C7.29279 2.66651 6.61451 2.94746 6.11441 3.44756C5.61432 3.94766 5.33336 4.62594 5.33336 5.33318V17.7865M13.8374 16.8292C14.3683 16.2987 15.0883 16.001 15.8388 16.0013C16.5893 16.0017 17.3089 16.3002 17.8394 16.8312C18.3698 17.3621 18.6676 18.0821 18.6672 18.8326C18.6668 19.5831 18.3683 20.3027 17.8374 20.8332L11.1467 27.5158C10.8299 27.8329 10.4383 28.0649 10.008 28.1905L6.18536 29.3065C6.07063 29.34 5.94902 29.342 5.83324 29.3123C5.71747 29.2827 5.6118 29.2224 5.52729 29.1379C5.44279 29.0534 5.38255 28.9477 5.35289 28.832C5.32323 28.7162 5.32523 28.5946 5.3587 28.4798L6.47336 24.6545C6.5992 24.2248 6.83122 23.8336 7.14803 23.5172L13.8374 16.8292Z" stroke="#302F37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>', 'iconUrl' => '', 'enabled' => true, 'flow' => $all_sections ),
        );

        $all_sign_style_ids = array_values( array_map( function( $style ) {
            return isset( $style['id'] ) ? $style['id'] : '';
        }, $sign_styles ) );

        $surfaces = $this->build_default_installation_surfaces( $surface_base, $all_sign_style_ids );

        // Shapes
        $shapes = array(
            array( 'id' => 'rectangle', 'label' => '13" x 10"',  'width' => 13, 'height' => 10,  'basePrice' => 150, 'signStyleIds' => $all_sign_style_ids, 'enabled' => true ),
            array( 'id' => 'oval',      'label' => '13" x 9"',   'width' => 13, 'height' => 9,   'basePrice' => 129, 'signStyleIds' => $all_sign_style_ids, 'enabled' => true ),
            array( 'id' => 'round',     'label' => '9" x 13"',   'width' => 9,  'height' => 13,  'basePrice' => 175, 'signStyleIds' => $all_sign_style_ids, 'enabled' => true ),
            array( 'id' => 'arch',      'label' => '24" x 12"',  'width' => 24, 'height' => 12,  'basePrice' => 240, 'signStyleIds' => $all_sign_style_ids, 'enabled' => true ),
        );

        $all_shape_ids = array_values( array_map( function( $shape ) {
            return isset( $shape['id'] ) ? $shape['id'] : '';
        }, $shapes ) );

        // Slate Colors – with shape-specific image overrides
        $slate_base_files = array(
            'black'        => 'slate_black.jpg',
            'mottle-black' => 'slate_mottledblack.jpg',
            'gray'         => 'slate_grey.jpg',
            'green'        => 'slate_green.jpg',
            'red'          => 'slate_red.jpg',
            'variegated'   => 'slate_variegated.jpg',
            'burgundy'     => 'slate_burgundy.jpg',
        );

        $slate_shape_overrides = array(
            'rectangle' => array(
                'gray'       => '10x13grey.jpg',
                'green'      => '10x13green.jpg',
                'red'        => '10x13red.jpg',
                'variegated' => '10x13variegated.jpg',
                'burgundy'   => '10x13burgundy.jpg',
            ),
            'arch' => array(
                'black' => '12x24black.jpg',
                'gray'  => '12x24grey.jpg',
                'green' => '12x24green.jpg',
            ),
        );

        $slate_colors = array(
            array( 'id' => 'black',        'label' => 'Black',        'price' => 0,  'shapeIds' => $all_shape_ids, 'enabled' => true ),
            array( 'id' => 'mottle-black', 'label' => 'Mottle Black', 'price' => 15, 'shapeIds' => $all_shape_ids, 'enabled' => true ),
            array( 'id' => 'gray',         'label' => 'Gray',         'price' => 15, 'shapeIds' => $all_shape_ids, 'enabled' => true ),
            array( 'id' => 'green',        'label' => 'Green',        'price' => 0,  'shapeIds' => $all_shape_ids, 'enabled' => true ),
            array( 'id' => 'red',          'label' => 'Red',          'price' => 20, 'shapeIds' => $all_shape_ids, 'enabled' => true ),
            array( 'id' => 'variegated',   'label' => 'Variegated',   'price' => 30, 'shapeIds' => $all_shape_ids, 'enabled' => true ),
            array( 'id' => 'burgundy',     'label' => 'Burgundy',     'price' => 25, 'shapeIds' => $all_shape_ids, 'enabled' => true ),
        );

        foreach ( $slate_colors as &$sc ) {
            $base_file = $slate_base_files[ $sc['id'] ] ?? '';
            $default_url = $base_file ? $slate_base . $base_file : '';

            $sc['imageUrl'] = $default_url;
            $sc['images'] = array(
                'default'   => $default_url,
                'rectangle' => $slate_base . ( $slate_shape_overrides['rectangle'][ $sc['id'] ] ?? $base_file ),
                'oval'      => $default_url,
                'round'     => $default_url,
                'arch'      => $slate_base . ( $slate_shape_overrides['arch'][ $sc['id'] ] ?? $base_file ),
            );
        }
        unset( $sc );

        // Design Templates – seeded from assets/images/template/{shape}/{tier}/*.png.
        $template_base     = $plugin_url . 'assets/images/template/';
        $design_templates  = $this->build_default_design_templates( $template_base, $all_sign_style_ids );

        // Paint Colors
        $paint_colors = array(
            array( 'id' => 'white',        'label' => 'White',        'hex' => '#f2f4ef', 'price' => 0, 'image' => 'PAINT white.jpg',         'imageUrl' => $paint_base . rawurlencode( 'PAINT white.jpg' ),         'enabled' => true ),
            array( 'id' => 'ivory',        'label' => 'Ivory',        'hex' => '#ece6cd', 'price' => 0, 'image' => 'PAINT ivory.jpg',         'imageUrl' => $paint_base . rawurlencode( 'PAINT ivory.jpg' ),         'enabled' => true ),
            array( 'id' => 'copper',       'label' => 'Copper',       'hex' => '#b97145', 'price' => 0, 'image' => 'PAINT Copper.jpg',        'imageUrl' => $paint_base . rawurlencode( 'PAINT Copper.jpg' ),        'enabled' => true ),
            array( 'id' => 'taupe',        'label' => 'Taupe',        'hex' => '#8d8477', 'price' => 0, 'image' => 'PAINT Taupe.jpg',         'imageUrl' => $paint_base . rawurlencode( 'PAINT Taupe.jpg' ),         'enabled' => true ),
            array( 'id' => 'brass',        'label' => 'Brass',        'hex' => '#b4a37a', 'price' => 0, 'image' => 'PAINT brass.jpg',         'imageUrl' => $paint_base . rawurlencode( 'PAINT brass.jpg' ),         'enabled' => true ),
            array( 'id' => 'copper-ivory', 'label' => 'Copper Ivory', 'hex' => '#c49a68', 'price' => 0, 'image' => 'PAINT Copper-Ivory.jpg',  'imageUrl' => $paint_base . rawurlencode( 'PAINT Copper-Ivory.jpg' ),  'enabled' => true ),
            array( 'id' => 'silver',       'label' => 'White/Silver', 'hex' => '#c9cbcf', 'price' => 0, 'image' => 'PAINT White-Siilver.jpg', 'imageUrl' => $paint_base . rawurlencode( 'PAINT White-Siilver.jpg' ), 'enabled' => true ),
        );

        // Add-ons
        $addons = array(
            array( 'id' => 'none',         'label' => 'No add-ons',              'price' => 0,  'enabled' => true ),
            array( 'id' => 'night-vision', 'label' => 'Night Vision ($15)',       'price' => 15, 'enabled' => true ),
            array( 'id' => 'reflective',   'label' => 'Reflective Paint ($20)',   'price' => 20, 'enabled' => true ),
        );

        // Mounting Hardware
        $mounting_hardware = array(
            array( 'id' => 'none',      'label' => 'No hardware',                      'price' => 0,  'enabled' => true ),
            array( 'id' => 'rosettes',  'label' => 'Hand Cast Bronze Rosettes (+$25)',  'price' => 25, 'enabled' => true ),
            array( 'id' => 'standoffs', 'label' => 'Stainless Standoffs (+$18)',        'price' => 18, 'enabled' => true ),
        );

        // Save all
        update_option( self::OPT_STEPS,             wp_json_encode( $steps ),             false );
        update_option( self::OPT_SIGN_STYLES,        wp_json_encode( $sign_styles ),       false );
        update_option( self::OPT_SURFACES,           wp_json_encode( $surfaces ),          false );
        update_option( self::OPT_SHAPES,             wp_json_encode( $shapes ),            false );
        update_option( self::OPT_SLATE_COLORS,       wp_json_encode( $slate_colors ),      false );
        update_option( self::OPT_DESIGN_TEMPLATES,   wp_json_encode( $design_templates ),  false );
        update_option( self::OPT_PAINT_COLORS,       wp_json_encode( $paint_colors ),      false );
        update_option( self::OPT_ADDONS,             wp_json_encode( $addons ),            false );
        update_option( self::OPT_MOUNTING_HARDWARE,  wp_json_encode( $mounting_hardware ), false );
        update_option( 'sign_selector_seeded', $current_version, false );
    }

    /* ─── Public getter for frontend localization ───────────── */

    /**
     * Get all enabled configurator data for the frontend.
     *
     * @return array<string, array>
     */
    public function get_frontend_data() {
        $filter_enabled = function ( $items ) {
            return array_values( array_filter( $items, function ( $item ) {
                return ! isset( $item['enabled'] ) || true === $item['enabled'];
            } ) );
        };

        $design_templates = array_map(
            array( $this, 'normalize_design_template_item' ),
            $filter_enabled( $this->get_option_items( self::OPT_DESIGN_TEMPLATES ) )
        );

        return array(
            'flowSections'     => self::FLOW_SECTIONS,
            'steps'            => $filter_enabled( $this->get_option_items( self::OPT_STEPS ) ),
            'signStyles'       => $filter_enabled( $this->get_option_items( self::OPT_SIGN_STYLES ) ),
            'surfaces'         => $filter_enabled( $this->get_option_items( self::OPT_SURFACES ) ),
            'shapes'           => $filter_enabled( $this->get_option_items( self::OPT_SHAPES ) ),
            'slateColors'      => $filter_enabled( $this->get_option_items( self::OPT_SLATE_COLORS ) ),
            'designTemplates'  => $design_templates,
            'paintColors'      => $filter_enabled( $this->get_option_items( self::OPT_PAINT_COLORS ) ),
            'addons'           => $filter_enabled( $this->get_option_items( self::OPT_ADDONS ) ),
            'mountingHardware' => $filter_enabled( $this->get_option_items( self::OPT_MOUNTING_HARDWARE ) ),
        );
    }

    /**
     * Ensure template field metadata is always available to the frontend.
     *
     * @param array<string,mixed> $item Template item.
     * @return array<string,mixed>
     */
    private function normalize_design_template_item( $item ) {
        if ( ! is_array( $item ) ) {
            return array();
        }

        $valid_fields = array( 'firstLine', 'secondLine', 'topText', 'houseNumber', 'bottomText' );

        if ( ! isset( $item['fields'] ) || ! is_array( $item['fields'] ) ) {
            $item['fields'] = array( 'houseNumber', 'bottomText' );
        } else {
            $item['fields'] = array_values( array_intersect( $item['fields'], $valid_fields ) );
            if ( empty( $item['fields'] ) ) {
                $item['fields'] = array( 'houseNumber', 'bottomText' );
            }
        }

        if ( empty( $item['textLayout'] ) || ! is_string( $item['textLayout'] ) ) {
            if ( in_array( 'firstLine', $item['fields'], true ) || in_array( 'secondLine', $item['fields'], true ) ) {
                $item['textLayout'] = in_array( 'secondLine', $item['fields'], true ) ? 'two-lines' : 'one-line';
            } elseif ( in_array( 'topText', $item['fields'], true ) ) {
                $item['textLayout'] = 'top-number-bottom';
            } elseif ( in_array( 'bottomText', $item['fields'], true ) ) {
                $item['textLayout'] = 'number-bottom';
            } else {
                $item['textLayout'] = 'number';
            }
        }

        return $item;
    }
}
