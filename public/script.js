document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const uploadForm = document.getElementById('uploadForm');
    const imageInput = document.getElementById('imageFiles');
    const fileCountDisplay = document.getElementById('fileCount');
    const uploadButton = document.getElementById('uploadButton');
    const sortButton = document.getElementById('sortButton');
    const statusBox = document.getElementById('status');
    const downloadSection = document.getElementById('downloadSection');
    const zipLinks = document.getElementById('zipLinks');
    const categoryCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    
    // Uploaded files tracking
    let uploadedFiles = false;
    
    // Update file count display when files are selected
    imageInput.addEventListener('change', () => {
        const fileCount = imageInput.files.length;
        if (fileCount > 0) {
            fileCountDisplay.textContent = `${fileCount} file${fileCount !== 1 ? 's' : ''} selected`;
        } else {
            fileCountDisplay.textContent = 'No files selected';
        }
    });
    
    // Handle form submission for uploading images
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const files = imageInput.files;
        if (files.length === 0) {
            showStatus('Please select at least one image', 'error');
            return;
        }
        
        // Check if files are images
        for (let i = 0; i < files.length; i++) {
            if (!files[i].type.startsWith('image/')) {
                showStatus(`File "${files[i].name}" is not an image. Please select only image files.`, 'error');
                return;
            }
        }
        
        showStatus('Uploading images...', 'info');
        uploadButton.disabled = true;
        
        try {
            const formData = new FormData();
            
            // Add files to FormData
            for (let i = 0; i < files.length; i++) {
                formData.append('images', files[i]);
            }
            
            // Upload the files
            const response = await fetch('/.netlify/functions/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                showStatus(`Successfully uploaded ${result.uploaded.length} images. You can now select categories for sorting.`, 'success');
                uploadedFiles = true;
                enableSortingIfReady();
            } else {
                throw new Error(result.message || 'Unknown error during upload');
            }
        } catch (error) {
            console.error('Upload error:', error);
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            uploadButton.disabled = false;
        }
    });
    
    // Monitor category selection to enable/disable sort button
    categoryCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', enableSortingIfReady);
    });
    
    // Handle sort button click
    sortButton.addEventListener('click', async () => {
        if (!uploadedFiles) {
            showStatus('Please upload images first', 'warning');
            return;
        }
        
        const selectedCategories = getSelectedCategories();
            
        if (selectedCategories.length === 0) {
            showStatus('Please select at least one category', 'warning');
            return;
        }
        
        showStatus('Processing images with AI and creating zip files...', 'info');
        sortButton.disabled = true;
        
        try {
            const response = await fetch('/.netlify/functions/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ categories: selectedCategories })
            });
            
            if (!response.ok) {
                throw new Error(`Processing failed: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                showStatus(`Successfully sorted images into ${result.zipFiles.length} categories.`, 'success');
                displayDownloadLinks(result.zipFiles);
            } else {
                throw new Error(result.message || 'Unknown error during processing');
            }
        } catch (error) {
            console.error('Processing error:', error);
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            sortButton.disabled = false;
        }
    });
    
    // Helper function to get selected categories
    function getSelectedCategories() {
        return Array.from(categoryCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
    }
    
    // Helper function to check if sorting should be enabled
    function enableSortingIfReady() {
        const anyCheckboxSelected = Array.from(categoryCheckboxes).some(cb => cb.checked);
        sortButton.disabled = !(uploadedFiles && anyCheckboxSelected);
    }
    
    // Helper function to show status messages
    function showStatus(message, type = 'info') {
        statusBox.textContent = message;
        statusBox.className = `status show ${type}`;
    }
    
    // Helper function to display download links
    function displayDownloadLinks(zipFiles) {
        zipLinks.innerHTML = '';
        
        if (zipFiles && zipFiles.length > 0) {
            zipFiles.forEach(zipFile => {
                const link = document.createElement('a');
                link.href = zipFile.url;
                link.className = 'zip-link';
                link.download = zipFile.filename;
                link.textContent = `${zipFile.categoryName} (${zipFile.count} images)`;
                zipLinks.appendChild(link);
            });
            downloadSection.classList.remove('hidden');
        } else {
            showStatus('No matching images found for the selected categories', 'warning');
        }
    }
});
