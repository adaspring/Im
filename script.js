// script.js — handles upload and sort interactions

document.addEventListener('DOMContentLoaded', () => {
  const uploadForm = document.getElementById('upload-form');
  const uploadBtn = document.getElementById('upload-btn');
  const sortBtn = document.getElementById('sort-btn');
  const statusBox = document.getElementById('status-box');
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');

  let uploadedImages = [];

  function getSelectedCategories() {
    return Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);
  }

  function updateSortButtonState() {
    const hasSelection = getSelectedCategories().length > 0;
    sortBtn.disabled = !hasSelection || uploadedImages.length === 0;
  }

  checkboxes.forEach(cb => {
    cb.addEventListener('change', updateSortButtonState);
  });

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const images = document.getElementById('image-input').files;
    if (!images.length) {
      statusBox.textContent = "Please select images to upload.";
      return;
    }

    statusBox.textContent = "Uploading images...";

    const formData = new FormData();
    for (const img of images) {
      formData.append('images', img);
    }

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();

      if (result.success) {
        statusBox.textContent = "Images uploaded. Now select categories and click Sort.";
        uploadedImages = result.uploaded;
        updateSortButtonState();
      } else {
        statusBox.textContent = "Upload failed: " + (result.error || "Unknown error.");
      }
    } catch (err) {
      statusBox.textContent = "Error uploading: " + err.message;
    }
  });

  sortBtn.addEventListener('click', async () => {
    const categories = getSelectedCategories();
    if (!categories.length) {
      statusBox.textContent = "Select at least one category to sort.";
      return;
    }

    statusBox.textContent = "Sorting and classifying images...";

    const formData = new FormData();
    formData.append('selected', JSON.stringify(categories));

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();

      if (result.success) {
        statusBox.textContent = "Done! Images sorted and zipped per category.";
      } else {
        statusBox.textContent = "Sort failed: " + (result.error || "Unknown error.");
      }
    } catch (err) {
      statusBox.textContent = "Error sorting: " + err.message;
    }
  });
});
