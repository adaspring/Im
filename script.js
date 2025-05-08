document.addEventListener('DOMContentLoaded', function () {
  const fileInput = document.getElementById('file-input');
  const uploadBtn = document.getElementById('upload-btn');
  const sortBtn = document.getElementById('sort-btn');
  const statusBox = document.getElementById('status');
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');

  function getSelectedTags() {
    return Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);
  }

  checkboxes.forEach(cb => cb.addEventListener('change', () => {
    sortBtn.disabled = getSelectedTags().length === 0;
  }));

  uploadBtn.addEventListener('click', async () => {
    const files = fileInput.files;
    if (!files.length) {
      statusBox.textContent = 'Please select at least one image.';
      return;
    }

    const formData = new FormData();
    for (const file of files) {
      formData.append('file', file, file.name);
    }

    statusBox.textContent = 'Uploading...';
    try {
      const response = await fetch('/.netlify/functions/upload', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      if (result.success) {
        statusBox.textContent = `Uploaded ${result.uploaded} files.`;
        sortBtn.disabled = getSelectedTags().length === 0;
      } else {
        statusBox.textContent = 'Upload failed.';
      }
    } catch (err) {
      statusBox.textContent = 'Error uploading images.';
    }
  });

  sortBtn.addEventListener('click', async () => {
    const tags = getSelectedTags();
    if (tags.length === 0) {
      statusBox.textContent = 'Please select at least one category.';
      return;
    }

    const formData = new FormData();
    formData.append('tags', tags.join(','));

    statusBox.textContent = 'Sorting and classifying...';
    try {
      const response = await fetch('/.netlify/functions/upload', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      if (result.sorted) {
        statusBox.textContent = 'Sorting complete! You can download your zip files from GitHub.';
      } else {
        statusBox.textContent = 'No matching files to sort.';
      }
    } catch (err) {
      statusBox.textContent = 'Error during sorting.';
    }
  });
});
