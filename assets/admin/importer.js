/**
 * Sign Selector — Import Template Images
 * Vanilla JS (jQuery optional for ajaxURL compat) that drives the import UI.
 */
(function () {
    'use strict';

    // ─── DOM refs ───────────────────────────────────────────────
    const form        = document.getElementById('ss-import-form');
    const fileInput   = document.getElementById('ss-zip-file');
    const dropzone    = document.getElementById('ss-dropzone');
    const selectedLbl = document.getElementById('ss-selected-filename');
    const importBtn   = document.getElementById('ss-import-btn');

    const progressCard = document.getElementById('ss-progress-card');
    const progressBar  = document.getElementById('ss-progress-bar');
    const progressCnt  = document.getElementById('ss-progress-count');
    const progressTitle= document.getElementById('ss-progress-title');
    const logContainer = document.getElementById('ss-import-log');

    const summaryCard  = document.getElementById('ss-summary-card');
    const summaryStats = document.getElementById('ss-summary-stats');
    const resultsTbody = document.getElementById('ss-results-tbody');

    if ( ! form ) return;

    // ─── Config from wp_localize_script ─────────────────────────
    const cfg = window.SS_IMPORTER || {};

    // ─── File selection ─────────────────────────────────────────
    fileInput.addEventListener('change', function () {
        if ( this.files && this.files[0] ) {
            setSelectedFile( this.files[0] );
        }
    });

    // ─── Drag & drop ─────────────────────────────────────────────
    dropzone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropzone.classList.add('ss-drop-active');
    });

    dropzone.addEventListener('dragleave', function () {
        dropzone.classList.remove('ss-drop-active');
    });

    dropzone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropzone.classList.remove('ss-drop-active');
        const file = e.dataTransfer && e.dataTransfer.files[0];
        if ( file && file.name.endsWith('.zip') ) {
            // Transfer to input so FormData picks it up
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            setSelectedFile(file);
        } else {
            showAlert('Please drop a .zip file.', 'error');
        }
    });

    function setSelectedFile(file) {
        selectedLbl.textContent = '📄 ' + file.name + ' (' + formatBytes(file.size) + ')';
        dropzone.classList.add('ss-has-file');
    }

    // ─── Form submit ─────────────────────────────────────────────
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        if ( ! fileInput.files || ! fileInput.files[0] ) {
            showAlert('Please select a ZIP file first.', 'error');
            return;
        }

        const file = fileInput.files[0];
        if ( ! file.name.endsWith('.zip') ) {
            showAlert('Only .zip files are accepted.', 'error');
            return;
        }

        startImport(file);
    });

    // ─── Import ──────────────────────────────────────────────────
    function startImport(file) {
        // Reset UI
        resetUI();
        progressCard.style.display = 'block';
        summaryCard.style.display  = 'none';
        importBtn.disabled = true;
        importBtn.textContent = 'Importing…';
        setProgress(0);
        addLog('info', '🚀 Starting import of ' + file.name + '…');

        const fd = new FormData(form);
        fd.append('action', cfg.action);
        fd.append('nonce',  cfg.nonce);
        fd.set('zip_file',  file); // ensure it's the actual file object

        const xhr = new XMLHttpRequest();
        xhr.open('POST', cfg.ajaxUrl, true);

        // Upload progress
        xhr.upload.addEventListener('progress', function (e) {
            if ( e.lengthComputable ) {
                const pct = Math.round( (e.loaded / e.total) * 40 ); // 0-40 for upload phase
                setProgress(pct);
                progressTitle.textContent = 'Uploading… ' + pct + '%';
            }
        });

        xhr.addEventListener('load', function () {
            let json;
            try {
                json = JSON.parse(xhr.responseText);
            } catch (err) {
                addLog('error', '❌ Invalid server response: ' + xhr.responseText.substring(0, 200));
                finishImport(false);
                return;
            }

            if ( ! json.success ) {
                addLog('error', '❌ Server error: ' + (json.data && json.data.message ? json.data.message : 'Unknown error'));
                finishImport(false);
                return;
            }

            processResults(json.data);
        });

        xhr.addEventListener('error', function () {
            addLog('error', '❌ Network error — please try again.');
            finishImport(false);
        });

        xhr.send(fd);

        // Simulate processing progress (40-90%) while waiting
        addLog('info', '⏳ ZIP uploaded. Server is extracting and uploading images…');
        animateProgress(40, 90, 8000);
    }

    function processResults(data) {
        setProgress(95);
        progressTitle.textContent = 'Finalising…';

        const results = data.results || [];
        const counts  = data.counts  || {};

        // Log summary
        addLog('info', '─────────────────────────────────');
        results.forEach(function (r) {
            const icon = { success: '✅', skipped: '⏭', error: '❌', no_match: '⚠️' }[r.status] || '•';
            addLog(
                r.status === 'error' || r.status === 'no_match' ? 'error' : r.status === 'skipped' ? 'warn' : 'success',
                icon + ' [' + r.template + '] ' + r.slate + ' / ' + r.tier + ' / ' + r.paint + '.* → ' + r.message
            );
        });

        // Build summary stats
        summaryStats.innerHTML = [
            stat('✅ Imported',   counts.success   || 0, 'success'),
            stat('⏭ Skipped',   counts.skipped   || 0, 'warn'),
            stat('⚠️ No Match',  counts.no_match  || 0, 'warn'),
            stat('❌ Errors',    counts.error     || 0, 'error'),
        ].join('');

        // Build results table
        resultsTbody.innerHTML = '';
        results.forEach(function (r) {
            const tr = document.createElement('tr');
            tr.className = 'ss-row-' + r.status;
            tr.innerHTML =
                '<td>' + esc(r.template) + '</td>' +
                '<td>' + esc(r.slate) + '</td>' +
                '<td>' + esc(r.paint) + '</td>' +
                '<td><span class="ss-badge ss-badge-' + esc(r.status) + '">' +
                    esc(r.status) + (r.message ? ' — ' + esc(r.message) : '') +
                '</span></td>';
            resultsTbody.appendChild(tr);
        });

        setProgress(100);
        finishImport(true);
        summaryCard.style.display = 'block';
        summaryCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function finishImport(success) {
        importBtn.disabled = false;
        importBtn.textContent = 'Import Images';
        progressTitle.textContent = success ? '✅ Import complete!' : '❌ Import failed';
        setProgress( success ? 100 : 0 );
        if ( success ) {
            addLog('success', '✅ Done! Design template records have been updated.');
        }
    }

    // ─── Progress helpers ────────────────────────────────────────
    let _animTimer = null;

    function setProgress(pct) {
        progressBar.style.width = pct + '%';
        progressBar.setAttribute('aria-valuenow', pct);
    }

    function animateProgress(from, to, durationMs) {
        if ( _animTimer ) clearInterval(_animTimer);
        const steps = 60;
        const stepDur = durationMs / steps;
        const increment = (to - from) / steps;
        let current = from;
        _animTimer = setInterval(function () {
            current = Math.min(current + increment, to);
            setProgress(Math.round(current));
            progressCnt.textContent = Math.round(current) + '%';
            if ( current >= to ) clearInterval(_animTimer);
        }, stepDur);
    }

    // ─── Log ────────────────────────────────────────────────────
    function addLog(type, message) {
        const div = document.createElement('div');
        div.className = 'ss-log-line ss-log-' + type;
        div.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
        logContainer.appendChild(div);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    // ─── Utilities ───────────────────────────────────────────────
    function resetUI() {
        logContainer.innerHTML = '';
        resultsTbody.innerHTML = '';
        summaryStats.innerHTML = '';
        if ( _animTimer ) clearInterval(_animTimer);
    }

    function stat(label, count, type) {
        return '<div class="ss-stat ss-stat-' + type + '">' +
               '<span class="ss-stat-count">' + count + '</span>' +
               '<span class="ss-stat-label">' + label + '</span>' +
               '</div>';
    }

    function esc(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatBytes(bytes) {
        if ( bytes < 1024 ) return bytes + ' B';
        if ( bytes < 1048576 ) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function showAlert(msg, type) {
        const existing = document.querySelector('.ss-inline-alert');
        if ( existing ) existing.remove();
        const div = document.createElement('div');
        div.className = 'ss-inline-alert ss-inline-alert-' + type;
        div.textContent = msg;
        form.prepend(div);
        setTimeout(() => div.remove(), 4000);
    }

})();
