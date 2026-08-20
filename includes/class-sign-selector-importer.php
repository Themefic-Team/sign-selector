<?php
/**
 * Sign Selector - Bulk Template Image Importer
 *
 * Adds an "Import Template Images" submenu page under Sign Selector.
 * Admin uploads a ZIP whose folder structure matches:
 *
 *   <Template Name>/
 *     <slate-color-id>/
 *       deluxe/   <paint-color-id>.webp ...
 *       regular/  <paint-color-id>.webp ...
 *
 * The importer extracts the ZIP, uploads every image into the WP Media
 * Library via media_handle_sideload(), and stores the resulting URLs in
 * a `variantImages` map on the matching design-template record.
 *
 * variantImages shape:
 *   { "<slateId>": { "deluxe": { "<paintId>": "<url>" }, "regular": { ... } } }
 *
 * @package SignSelector
 */

defined( 'ABSPATH' ) || exit;

class Sign_Selector_Importer {

    /** AJAX action name */
    const AJAX_ACTION = 'sign_selector_import_zip';

    /** Nonce name */
    const NONCE_KEY = 'sign_selector_import_nonce';

    /** Submenu page slug */
    const PAGE_SLUG = 'sign-selector-import';

    /** Option key for design templates (must match Sign_Selector_Admin) */
    const OPT_DESIGN_TEMPLATES = 'sign_selector_design_templates';

    /** Allowed image extensions inside the ZIP */
    const ALLOWED_EXTENSIONS = array( 'webp', 'jpg', 'jpeg', 'png' );

    public function __construct() {
        add_action( 'admin_menu',            array( $this, 'add_submenu' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
        add_action( 'wp_ajax_' . self::AJAX_ACTION, array( $this, 'handle_import' ) );
    }

    /* --- Admin menu --- */

    public function add_submenu() {
        add_submenu_page(
            'sign-selector',
            __( 'Import Template Images', 'sign-selector' ),
            __( 'Import Images', 'sign-selector' ),
            'manage_options',
            self::PAGE_SLUG,
            array( $this, 'render_page' )
        );
    }

    /* --- Assets --- */

    public function enqueue_assets( $hook ) {
        // The hook for a submenu page is: {parent_slug}_page_{page_slug}
        // For add_submenu_page under 'sign-selector', WP generates: sign-selector_page_sign-selector-import
        if ( false === strpos( $hook, self::PAGE_SLUG ) ) {
            return;
        }

        wp_enqueue_style(
            'sign-selector-importer-css',
            SIGN_SELECTOR_URL . 'assets/admin/importer.css',
            array(),
            SIGN_SELECTOR_VERSION
        );

        wp_enqueue_script(
            'sign-selector-importer-js',
            SIGN_SELECTOR_URL . 'assets/admin/importer.js',
            array( 'jquery' ),
            SIGN_SELECTOR_VERSION,
            true
        );

        wp_localize_script(
            'sign-selector-importer-js',
            'SS_IMPORTER',
            array(
                'ajaxUrl'    => admin_url( 'admin-ajax.php' ),
                'action'     => self::AJAX_ACTION,
                'nonce'      => wp_create_nonce( self::NONCE_KEY ),
                'maxSizeMB'  => (int) ( wp_max_upload_size() / ( 1024 * 1024 ) ),
            )
        );
    }

    /* --- Page render --- */

    public function render_page() {
        ?>
        <div class="wrap ss-import-wrap">
            <h1 class="ss-import-title">
                <span class="ss-import-icon"></span>
                <?php esc_html_e( 'Import Template Images', 'sign-selector' ); ?>
            </h1>
            <p class="ss-import-description">
                <?php esc_html_e(
                    'Upload a ZIP file with the template image folder structure. Each image will be imported into the Media Library and linked to the matching design template.',
                    'sign-selector'
                ); ?>
            </p>

            <div class="ss-import-structure-card">
                <h3><?php esc_html_e( 'Expected ZIP Structure', 'sign-selector' ); ?></h3>
                <pre class="ss-import-tree">  &lt;Template Name&gt;/          e.g. "Rectangle Deluxe #01"
    &lt;slate-color-id&gt;/         e.g. "black"
      &lt;paint-color-id&gt;.webp  e.g. "brass.webp"</pre>
            </div>

            <div class="ss-import-form-card">
                <form id="ss-import-form" enctype="multipart/form-data">
                    <div class="ss-import-dropzone" id="ss-dropzone">
                        <div class="ss-import-dropzone-inner">
                            <span class="ss-dropzone-icon"></span>
                            <p class="ss-dropzone-label">
                                <?php esc_html_e( 'Drag & drop your ZIP file here', 'sign-selector' ); ?>
                            </p>
                            <p class="ss-dropzone-sub">
                                <?php esc_html_e( 'or', 'sign-selector' ); ?>
                            </p>
                            <label class="ss-btn ss-btn-primary" for="ss-zip-file">
                                <?php esc_html_e( 'Browse File', 'sign-selector' ); ?>
                            </label>
                            <input type="file" id="ss-zip-file" name="zip_file" accept=".zip" class="ss-hidden-file-input">
                            <p class="ss-selected-filename" id="ss-selected-filename"></p>
                        </div>
                    </div>

                    <div class="ss-import-options">
                        <label class="ss-checkbox-label">
                            <input type="checkbox" id="ss-overwrite" name="overwrite" value="1" checked>
                            <?php esc_html_e( 'Overwrite existing variant images', 'sign-selector' ); ?>
                        </label>
                        <label class="ss-checkbox-label">
                            <input type="checkbox" id="ss-skip-media" name="skip_media_library" value="1">
                            <?php esc_html_e( 'Skip re-uploading if file already exists in Media Library (match by filename)', 'sign-selector' ); ?>
                        </label>
                    </div>

                    <button type="submit" class="ss-btn ss-btn-primary ss-btn-lg" id="ss-import-btn">
                        <?php esc_html_e( 'Import Images', 'sign-selector' ); ?>
                    </button>
                </form>
            </div>

            <!-- Progress + Results -->
            <div class="ss-import-progress-card" id="ss-progress-card" style="display:none;">
                <div class="ss-progress-header">
                    <h3 id="ss-progress-title"><?php esc_html_e( 'Importing...', 'sign-selector' ); ?></h3>
                    <span class="ss-progress-count" id="ss-progress-count">0 / 0</span>
                </div>
                <div class="ss-progress-bar-wrap">
                    <div class="ss-progress-bar" id="ss-progress-bar"></div>
                </div>
                <div class="ss-import-log" id="ss-import-log"></div>
            </div>

            <!-- Summary -->
            <div class="ss-import-summary-card" id="ss-summary-card" style="display:none;">
                <h3><?php esc_html_e( 'Import Complete', 'sign-selector' ); ?></h3>
                <div class="ss-summary-stats" id="ss-summary-stats"></div>
                <table class="ss-results-table" id="ss-results-table">
                    <thead>
                        <tr>
                            <th><?php esc_html_e( 'Template', 'sign-selector' ); ?></th>
                            <th><?php esc_html_e( 'Slate', 'sign-selector' ); ?></th>
                            <th><?php esc_html_e( 'Paint', 'sign-selector' ); ?></th>
                            <th><?php esc_html_e( 'Status', 'sign-selector' ); ?></th>
                        </tr>
                    </thead>
                    <tbody id="ss-results-tbody"></tbody>
                </table>
            </div>
        </div>
        <?php
    }

    /* --- AJAX handler --- */

    public function handle_import() {
        // Security checks
        check_ajax_referer( self::NONCE_KEY, 'nonce' );

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( array( 'message' => 'Insufficient permissions.' ), 403 );
        }

        // Validate uploaded file
        if ( empty( $_FILES['zip_file'] ) || ! isset( $_FILES['zip_file']['tmp_name'] ) ) {
            wp_send_json_error( array( 'message' => 'No ZIP file received.' ), 400 );
        }

        $file = $_FILES['zip_file'];

        if ( UPLOAD_ERR_OK !== $file['error'] ) {
            wp_send_json_error( array( 'message' => 'Upload error code: ' . (int) $file['error'] ), 400 );
        }

        $overwrite         = ! empty( $_POST['overwrite'] );
        $skip_media        = ! empty( $_POST['skip_media_library'] );

        // Extract ZIP to temp dir
        $extract_dir = $this->extract_zip( $file['tmp_name'] );
        if ( is_wp_error( $extract_dir ) ) {
            wp_send_json_error( array( 'message' => $extract_dir->get_error_message() ), 500 );
        }

        // Scan the tree and collect import tasks
        $tasks   = $this->scan_tree( $extract_dir );
        $results = array();

        // Load existing design templates
        $templates = $this->get_templates();

        // Ensure WP media functions are available
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $counts = array( 'success' => 0, 'skipped' => 0, 'error' => 0, 'no_match' => 0 );

        foreach ( $tasks as $task ) {
            $result = $this->process_task( $task, $templates, $overwrite, $skip_media );
            $results[] = $result;

            if ( 'success' === $result['status'] ) {
                $counts['success']++;
                $tpl_idx = $result['tpl_idx'];
                if ( false !== $tpl_idx ) {
                    $slate = $result['slate'];
                    $paint = $result['paint'];
                    $url   = $result['url'];

                    // Key format matches admin.js: "{slateId}_{paintId}"
                    $combo_key = $slate . '_' . $paint;

                    $existing = isset( $templates[ $tpl_idx ]['combinationImages'] )
                        ? (array) $templates[ $tpl_idx ]['combinationImages']
                        : array();

                    $existing[ $combo_key ] = $url;
                    $templates[ $tpl_idx ]['combinationImages'] = $existing;
                }
            } elseif ( 'skipped' === $result['status'] ) {
                $counts['skipped']++;
            } elseif ( 'no_match' === $result['status'] ) {
                $counts['no_match']++;
            } else {
                $counts['error']++;
            }
        }

        // Persist updated templates back to wp_options
        $encoded = wp_json_encode( array_values( $templates ) );
        $saved   = update_option( self::OPT_DESIGN_TEMPLATES, $encoded, false );
        wp_cache_delete( self::OPT_DESIGN_TEMPLATES, 'options' );

        // If update_option returns false it may mean the value was already
        // identical - force a direct DB write to guarantee persistence.
        if ( ! $saved ) {
            global $wpdb;
            $wpdb->update(
                $wpdb->options,
                array( 'option_value' => $encoded ),
                array( 'option_name'  => self::OPT_DESIGN_TEMPLATES )
            );
            wp_cache_delete( self::OPT_DESIGN_TEMPLATES, 'options' );
        }

        // Cleanup
        $this->cleanup_dir( $extract_dir );

        wp_send_json_success( array(
            'counts'  => $counts,
            'results' => $results,
        ) );
    }

    /* --- ZIP extraction --- */

    /**
     * Extract a ZIP file to a unique temp directory.
     *
     * @param string $zip_path Path to the uploaded ZIP tmp file.
     * @return string|WP_Error Extracted directory path or error.
     */
    private function extract_zip( $zip_path ) {
        if ( ! class_exists( 'ZipArchive' ) ) {
            return new WP_Error( 'no_zip', 'ZipArchive PHP extension is not available.' );
        }

        $zip = new ZipArchive();
        $opened = $zip->open( $zip_path );

        if ( true !== $opened ) {
            return new WP_Error( 'zip_open_failed', 'Could not open the ZIP file (code: ' . $opened . ').' );
        }

        $upload_dir  = wp_upload_dir();
        $extract_dir = trailingslashit( $upload_dir['basedir'] ) . 'ss-import-tmp-' . uniqid();

        wp_mkdir_p( $extract_dir );

        $zip->extractTo( $extract_dir );
        $zip->close();

        return $extract_dir;
    }

    /* --- Tree scanner --- */

    /**
     * Walk the extracted directory tree and collect import tasks.
     *
     * Structure:
     *   root/
     *     <Template Name>/     e.g. "Rectangle Deluxe #01"
     *       <slate-color-id>/  e.g. "black"
     *         <paint-id>.webp  e.g. "brass.webp"
     *
     * @param string $root Extracted temp directory.
     * @return array[] List of task arrays.
     */
    private function scan_tree( $root ) {
        $tasks = array();

        // Auto-detect wrapper folder: if the ZIP root contains exactly one
        // directory that isn't itself a template name, descend into it.
        $children = glob( trailingslashit( $root ) . '*', GLOB_ONLYDIR );
        $effective_root = $root;

        if ( is_array( $children ) && 1 === count( $children ) ) {
            if ( ! $this->parse_template_folder_name( basename( $children[0] ) ) ) {
                $effective_root = $children[0];
            }
        }

        // Level 1: template name folders  e.g. "Rectangle Deluxe #01"
        $tpl_dirs = glob( trailingslashit( $effective_root ) . '*', GLOB_ONLYDIR );
        if ( ! is_array( $tpl_dirs ) ) {
            return $tasks;
        }

        foreach ( $tpl_dirs as $tpl_dir ) {
            $tpl_folder = basename( $tpl_dir );
            $tpl_meta   = $this->parse_template_folder_name( $tpl_folder );
            if ( ! $tpl_meta ) {
                continue; // skip unrecognised folders
            }

            // Level 2: slate color folders  e.g. "black"
            $slate_dirs = glob( trailingslashit( $tpl_dir ) . '*', GLOB_ONLYDIR );
            if ( ! is_array( $slate_dirs ) ) {
                continue;
            }

            foreach ( $slate_dirs as $slate_dir ) {
                $slate_id = strtolower( basename( $slate_dir ) );

                // Level 3: image files directly inside the slate folder
                $files = glob( trailingslashit( $slate_dir ) . '*' );
                if ( ! is_array( $files ) ) {
                    continue;
                }

                foreach ( $files as $file_path ) {
                    if ( ! is_file( $file_path ) ) {
                        continue;
                    }
                    $ext = strtolower( pathinfo( $file_path, PATHINFO_EXTENSION ) );
                    if ( ! in_array( $ext, self::ALLOWED_EXTENSIONS, true ) ) {
                        continue;
                    }

                    $tasks[] = array(
                        'file_path'  => $file_path,
                        'file_name'  => basename( $file_path ),
                        'tpl_folder' => $tpl_folder,
                        'tpl_meta'   => $tpl_meta,
                        'slate'      => $slate_id,
                        'paint'      => strtolower( pathinfo( $file_path, PATHINFO_FILENAME ) ),
                    );
                }
            }
        }

        return $tasks;
    }

    /* --- Template folder name parser --- */

    /**
     * Parse a template folder name into metadata used to build the template ID.
     *
     * Pattern: "<Shape words> <Tier> #<NN>"
     * e.g. "Rectangle Deluxe #01" -> template_id = "tpl-rectangle-deluxe-01"
     *      "Oval Regular #03"     -> template_id = "tpl-oval-regular-03"
     *
     * Returns false if the name doesn't match.
     *
     * @param string $folder_name Folder name.
     * @return array{shape:string,number:string,template_id:string,folder_name:string}|false
     */
    private function parse_template_folder_name( $folder_name ) {
        // Shape words + tier keyword (deluxe|regular|standard) + #number
        if ( ! preg_match( '/^(.+?)\s+(deluxe|regular|standard)\s+#(\d+)$/i', $folder_name, $m ) ) {
            return false;
        }

        $shape  = sanitize_title( trim( $m[1] ) );  // e.g. "rectangle"
        $tier   = strtolower( trim( $m[2] ) );       // e.g. "deluxe"
        $number = str_pad( ltrim( $m[3], '0' ) ?: '0', 2, '0', STR_PAD_LEFT );

        return array(
            'shape'       => $shape,
            'tier'        => $tier,
            'number'      => $number,
            'template_id' => sprintf( 'tpl-%s-%s-%s', $shape, $tier, $number ),
            'folder_name' => $folder_name,
        );
    }

    /* --- Template DB helpers --- */

    /**
     * Load all design templates from wp_options.
     *
     * @return array<int, array> Templates indexed by position.
     */
    private function get_templates() {
        wp_cache_delete( self::OPT_DESIGN_TEMPLATES, 'options' );
        $raw = get_option( self::OPT_DESIGN_TEMPLATES, '[]' );
        $arr = json_decode( $raw, true );
        return is_array( $arr ) ? $arr : array();
    }

    /**
     * Find the index of a template by ID in the templates array.
     *
     * @param array  $templates  Templates array.
     * @param string $tpl_id     Template ID to find.
     * @return int|false Index or false if not found.
     */
    private function find_template_index( $templates, $tpl_id ) {
        foreach ( $templates as $idx => $tpl ) {
            if ( isset( $tpl['id'] ) && $tpl['id'] === $tpl_id ) {
                return $idx;
            }
        }
        return false;
    }

    /* --- Single task processor --- */

    /**
     * Process one image import task.
     *
     * @param array $task         Task descriptor from collect_image_tasks().
     * @param array $templates    Design templates (passed by reference).
     * @param bool  $overwrite    Whether to overwrite existing variantImages entries.
     * @param bool  $skip_media   Whether to skip re-uploading existing media files.
     * @return array Result descriptor.
     */
    private function process_task( $task, &$templates, $overwrite, $skip_media ) {
        $tpl_id  = $task['tpl_meta']['template_id'];
        $tpl_idx = $this->find_template_index( $templates, $tpl_id );
        $slate   = $task['slate'];
        $paint   = $task['paint'];

        $base_result = array(
            'template'    => $task['tpl_folder'],
            'template_id' => $tpl_id,
            'tier'        => $task['tpl_meta']['tier'],
            'slate'       => $slate,
            'paint'       => $paint,
            'file'        => $task['file_name'],
            'tpl_idx'     => $tpl_idx,
        );

        // Template not found
        if ( false === $tpl_idx ) {
            return array_merge( $base_result, array(
                'status'  => 'no_match',
                'message' => sprintf( 'No design template found with id "%s".', esc_html( $tpl_id ) ),
            ) );
        }

        // Check if variant image already exists and skip is requested
        if ( ! $overwrite ) {
            $combo_key    = $slate . '_' . $paint;
            $existing_map = isset( $templates[ $tpl_idx ]['combinationImages'] )
                ? (array) $templates[ $tpl_idx ]['combinationImages']
                : array();
            $existing_url = $existing_map[ $combo_key ] ?? '';
            if ( '' !== $existing_url ) {
                return array_merge( $base_result, array(
                    'status'  => 'skipped',
                    'message' => 'Already imported (overwrite disabled).',
                    'url'     => $existing_url,
                ) );
            }
        }

        // Optionally skip if a Media Library attachment with this filename already exists
        if ( $skip_media ) {
            $existing_attach = $this->find_attachment_by_filename( $task['file_name'] );
            if ( $existing_attach ) {
                $url = wp_get_attachment_url( $existing_attach );
                return array_merge( $base_result, array(
                    'status'  => 'success',
                    'message' => 'Reused existing Media Library entry.',
                    'url'     => $url,
                ) );
            }
        }

        // Upload to Media Library
        $url = $this->upload_image( $task['file_path'], $task['file_name'] );
        if ( is_wp_error( $url ) ) {
            return array_merge( $base_result, array(
                'status'  => 'error',
                'message' => $url->get_error_message(),
                'url'     => '',
            ) );
        }

        return array_merge( $base_result, array(
            'status'  => 'success',
            'message' => 'Uploaded successfully.',
            'url'     => $url,
        ) );
    }

    /* --- Media Library helpers --- */

    /**
     * Sideload an image file into the WP Media Library.
     *
     * @param string $file_path Absolute path to the image.
     * @param string $file_name Desired filename.
     * @return string|WP_Error Attachment URL or error.
     */
    private function upload_image( $file_path, $file_name ) {
        // media_handle_sideload() deletes the tmp_name after processing.
        // Copy to a safe temp location first so we don't lose the extracted file.
        $tmp_copy = wp_tempnam( $file_name );
        if ( ! $tmp_copy || ! copy( $file_path, $tmp_copy ) ) {
            return new WP_Error( 'copy_failed', 'Could not create a temp copy of: ' . $file_name );
        }

        $file_array = array(
            'name'     => $file_name,
            'tmp_name' => $tmp_copy,
            'error'    => UPLOAD_ERR_OK,
            'size'     => filesize( $tmp_copy ),
        );

        // Attach to no specific post (post_id = 0)
        $attach_id = media_handle_sideload( $file_array, 0, null, array(
            'post_title' => pathinfo( $file_name, PATHINFO_FILENAME ),
        ) );

        // Cleanup temp copy if it still exists (sideload may have already removed it)
        if ( file_exists( $tmp_copy ) ) {
            @unlink( $tmp_copy );
        }

        if ( is_wp_error( $attach_id ) ) {
            return $attach_id;
        }

        $url = wp_get_attachment_url( $attach_id );
        return $url ? $url : new WP_Error( 'no_url', 'Could not resolve attachment URL.' );
    }

    /**
     * Search for an existing Media Library attachment by filename.
     *
     * @param string $filename Exact filename to match.
     * @return int|false Attachment post ID or false.
     */
    private function find_attachment_by_filename( $filename ) {
        global $wpdb;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $attach_id = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT post_id FROM {$wpdb->postmeta}
                 WHERE meta_key = '_wp_attached_file'
                 AND meta_value LIKE %s
                 LIMIT 1",
                '%' . $wpdb->esc_like( $filename )
            )
        );

        return $attach_id ? (int) $attach_id : false;
    }

    /* --- Cleanup --- */

    /**
     * Recursively remove the temp extraction directory.
     *
     * @param string $dir Directory to remove.
     * @return void
     */
    private function cleanup_dir( $dir ) {
        if ( ! is_dir( $dir ) ) {
            return;
        }

        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator( $dir, RecursiveDirectoryIterator::SKIP_DOTS ),
            RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ( $files as $file_info ) {
            if ( $file_info->isDir() ) {
                rmdir( $file_info->getRealPath() );
            } else {
                unlink( $file_info->getRealPath() );
            }
        }

        rmdir( $dir );
    }
}

