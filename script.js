const uploadBtn = document.getElementById('uploadBtn'); const sortBtn = document.getElementById('sortBtn'); const uploadForm = document.getElementById('uploadForm'); const status = document.getElementById('status');

// Enable sort button only if at least one checkbox is selected uploadForm.querySelectorAll('input[name="params"]').forEach(cb => { cb.addEventListener('change', () => { const checked = [...uploadForm.querySelectorAll('input[name="params"]:checked')]; sortBtn.disabled = checked.length === 0; }); });

uploadBtn.addEventListener('click', async () => { const files = document.getElementById('images').files; if (!files.length) { status.textContent = 'Please select at least one image to upload.'; return; }

const formData = new FormData(); for (const file of files) { formData.append('images', file); }

status.textContent = 'Uploading images...'; try { const response = await fetch('/.netlify/functions/upload', { method: 'POST', body: formData, }); const result = await response.json(); if (result.success) { status.textContent = 'Images uploaded. Now select categories and click Sort & Zip.'; } else { status.textContent = 'Upload failed. Please try again.'; } } catch (err) { status.textContent = 'An error occurred while uploading. Please try again later.'; } });

uploadForm.addEventListener('submit', async function (e) { e.preventDefault(); const selectedParams = Array.from(uploadForm.querySelectorAll('input[name="params"]:checked')).map(cb => cb.value); if (!selectedParams.length) { status.textContent = 'Select at least one category before sorting.'; return; }

const formData = new FormData(); formData.append('selectedParams', JSON.stringify(selectedParams)); status.textContent = 'Triggering GPT classification and sorting...';

try { const response = await fetch('/.netlify/functions/upload', { method: 'POST', body: formData, }); const result = await response.json(); if (result.success) { status.textContent = 'Processing started. Check GitHub Actions shortly for download links.'; } else { status.textContent = 'Sorting trigger failed. Please try again.'; } } catch (err) { status.textContent = 'An error occurred while processing. Please try again later.'; } });

