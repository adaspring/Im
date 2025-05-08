document.getElementById('uploadForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData();
  const files = document.getElementById('images').files;
  const status = document.getElementById('status');

  if (!files.length) {
    status.textContent = 'Please select at least one image.';
    return;
  }

  for (const file of files) {
    formData.append('images', file);
  }

  const selectedParams = Array.from(form.querySelectorAll('input[name="params"]:checked')).map(cb => cb.value);
  if (selectedParams.length === 0) {
    status.textContent = 'Please select at least one category.';
    return;
  }

  formData.append('selectedParams', JSON.stringify(selectedParams));
  status.textContent = 'Uploading and triggering GPT image sorting...';

  try {
    const response = await fetch('/.netlify/functions/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    if (result.success) {
      status.textContent = 'Processing started! Check GitHub Actions for zips shortly.';
    } else {
      status.textContent = 'Upload failed. Please try again.';
    }
  } catch (err) {
    status.textContent = 'An error occurred. Please try again later.';
  }
});