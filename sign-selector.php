<?php
/**
 * Plugin Name:  Sign Selector 
 * Description:  A simple plugin to select and display a sign on your WordPress site.
 * Version: 1.0
 * Version: 1.0.0
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
// 

class SignSelector {
    public function __construct() {
        // constants
        if ( ! defined( 'SIGN_SELECTOR_VERSION' ) ) {
            define( 'SIGN_SELECTOR_VERSION', '1.0.0' );
        }
        if ( ! defined( 'SIGN_SELECTOR_URL' ) ) {
            define( 'SIGN_SELECTOR_URL', plugin_dir_url( __FILE__ ) );
        }
        if ( ! defined( 'SIGN_SELECTOR_PATH' ) ) {
            define( 'SIGN_SELECTOR_PATH', plugin_dir_path( __FILE__ ) );
        }
        if ( ! defined( 'SIGN_SELECTOR_DEV_MODE' ) ) {
            define( 'SIGN_SELECTOR_DEV_MODE', true );
        }

        // add content into footer
        // add_action( 'wp_footer', [ $this, 'render_app_container' ] );
        add_action( 'init', array( $this, 'init' ) ); 
    }
    public function init() {
        
        add_action( 'wp_enqueue_scripts', [ $this, 'register_assets' ] );
        add_filter( 'script_loader_tag', [ $this, 'tf_loadScriptAsModule' ], 10, 3 );
        add_shortcode( 'sign_selector', [ $this, 'render_shortcode' ] );
        add_action( 'wp_ajax_sign_selector_save_configuration', [ $this, 'handle_save_configuration' ] );
        add_action( 'wp_ajax_nopriv_sign_selector_save_configuration', [ $this, 'handle_save_configuration' ] );
    }

    public function tf_loadScriptAsModule( $tag, $handle, $src ) {
        if ( ! in_array( $handle, array( 'sign-selector-vite-client', 'tf-core-sign-selector' ), true ) ) {
            return $tag;
        }
        $tag = '<script type="module" src="' . esc_url( $src ) . '"></script>';
        return $tag;
        
    }

    public function register_assets() {
        if ( $this->should_use_dev_server() ) {
            $vite_server = $this->get_vite_server_url();

            wp_register_script( 'sign-selector-vite-client', $vite_server . '/@vite/client', array(), SIGN_SELECTOR_VERSION, true );
            wp_register_script( 'tf-core-sign-selector', $vite_server . '/src/main.js', array( 'sign-selector-vite-client' ), SIGN_SELECTOR_VERSION, true );

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
            array(),
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
        wp_localize_script(
            'tf-core-sign-selector',
            'SIGN_SELECTOR_CONFIG',
            array(
                'ajaxUrl' => admin_url( 'admin-ajax.php' ),
                'action'  => 'sign_selector_save_configuration',
                'nonce'   => wp_create_nonce( 'sign_selector_nonce' ),
            )
        );
    }

    /**
     * Receive sign configuration object from frontend.
     */
    public function handle_save_configuration() {
        check_ajax_referer( 'sign_selector_nonce', 'nonce' );

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

        wp_send_json_success(
            array(
                'message'       => __( 'Configuration received.', 'sign-selector' ),
                'configuration' => $configuration,
            )
        );
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
                $safe_key              = is_string( $key ) ? sanitize_key( $key ) : $key;
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

