// File: public/app.js
document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const postList = document.getElementById('post-list');
  const pdfList = document.getElementById('pdf-list');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const selectAllBtn = document.getElementById('select-all-btn');
  const deselectAllBtn = document.getElementById('deselect-all-btn');
  const scanSelectedBtn = document.getElementById('scan-selected-btn');
  const selectedCount = document.getElementById('selected-count');
  const downloadProgress = document.getElementById('download-progress');
  const downloadedFiles = document.getElementById('downloaded-files');

  // State
  let posts = [];
  let offset = 0;
  let selectedPosts = new Set();
  let availablePdfs = [];
  let downloadQueue = [];
  let isProcessing = false;

  // Initial load
  loadPosts();

  // Event listeners
  loadMoreBtn.addEventListener('click', () => {
    offset += 50;
    loadPosts();
  });

  selectAllBtn.addEventListener('click', () => {
    const postItems = document.querySelectorAll('.post-item');
    postItems.forEach(item => {
      item.classList.add('selected');
      selectedPosts.add(item.dataset.id);
    });
    updateSelectedCount();
  });

  deselectAllBtn.addEventListener('click', () => {
    const postItems = document.querySelectorAll('.post-item');
    postItems.forEach(item => {
      item.classList.remove('selected');
    });
    selectedPosts.clear();
    updateSelectedCount();
    pdfList.innerHTML = '<p class="text-muted">Select posts to see available PDFs</p>';
    availablePdfs = [];
  });

  scanSelectedBtn.addEventListener('click', async () => {
    if (selectedPosts.size === 0) {
      alert('Please select at least one post to scan.');
      return;
    }
    
    // Clear previous PDFs
    availablePdfs = [];
    pdfList.innerHTML = '<div class="text-center p-3"><div class="spinner-border" role="status"></div><p>Scanning selected posts for PDFs...</p></div>';
    
    // Process each selected post
    for (const postId of selectedPosts) {
      await getPostDetails(postId);
    }
    
    // Update the PDF list
    renderPdfList();
  });

  // Function to load posts
  async function loadPosts() {
    try {
      // Show loading only on first load
      if (offset === 0) {
        postList.innerHTML = `
          <div class="text-center p-5">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading posts...</p>
          </div>
        `;
      } else {
        // Add loading indicator at the bottom for "load more"
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'text-center p-3';
        loadingIndicator.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div> Loading more...';
        loadingIndicator.id = 'bottom-loading';
        postList.appendChild(loadingIndicator);
      }

      const response = await fetch(`/api/posts?offset=${offset}`);
      const newPosts = await response.json();
      
      // Remove loading indicator
      if (offset === 0) {
        postList.innerHTML = '';
      } else {
        const bottomLoading = document.getElementById('bottom-loading');
        if (bottomLoading) bottomLoading.remove();
      }
      
      // If no more posts, disable load more button
      if (newPosts.length === 0) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'No More Posts';
        return;
      }
      
      // Add new posts to our array and render
      posts = [...posts, ...newPosts];
      renderPosts();
      
    } catch (error) {
      console.error('Error loading posts:', error);
      postList.innerHTML = `<div class="alert alert-danger">Error loading posts: ${error.message}</div>`;
    }
  }

  // Render posts in the UI
  function renderPosts() {
    if (offset === 0) {
      postList.innerHTML = '';
    }
    
    posts.forEach(post => {
      // Check if this post is already rendered
      if (document.querySelector(`.post-item[data-id="${post.id}"]`)) {
        return;
      }
      
      const postDate = new Date(post.added * 1000).toLocaleDateString();
      const postElement = document.createElement('div');
      postElement.className = 'post-item';
      postElement.dataset.id = post.id;
      
      // Add selected class if this post is in our selected set
      if (selectedPosts.has(post.id)) {
        postElement.classList.add('selected');
      }
      
      postElement.innerHTML = `
        <div class="post-title">${post.title || 'Untitled Post'}</div>
        <div class="post-date">${postDate}</div>
      `;
      
      postElement.addEventListener('click', () => {
        postElement.classList.toggle('selected');
        
        if (postElement.classList.contains('selected')) {
          selectedPosts.add(post.id);
        } else {
          selectedPosts.delete(post.id);
        }
        
        updateSelectedCount();
      });
      
      postList.appendChild(postElement);
    });
  }

  // Update the selected count display
  function updateSelectedCount() {
    selectedCount.textContent = selectedPosts.size;
  }

  // Get details of a specific post
  async function getPostDetails(postId) {
    try {
      const response = await fetch(`/api/post/${postId}`);
      const postDetails = await response.json();
      
      // Add any PDFs found to our list
      if (postDetails.files && postDetails.files.length > 0) {
        postDetails.files.forEach(file => {
          availablePdfs.push({
            postId: postId,
            postTitle: postDetails.title || 'Untitled Post',
            name: file.name,
            url: file.url
          });
        });
      }
      
      return postDetails;
    } catch (error) {
      console.error(`Error fetching post ${postId}:`, error);
      return null;
    }
  }

  // Render PDF list
  function renderPdfList() {
    if (availablePdfs.length === 0) {
      pdfList.innerHTML = '<p class="text-center text-muted">No PDFs found in selected posts.</p>';
      return;
    }
    
    pdfList.innerHTML = '';
    
    // Create download all button
    const downloadAllBtn = document.createElement('button');
    downloadAllBtn.className = 'btn btn-primary mb-3';
    downloadAllBtn.textContent = `Download All PDFs (${availablePdfs.length})`;
    downloadAllBtn.addEventListener('click', () => {
      downloadAllPdfs();
    });
    pdfList.appendChild(downloadAllBtn);
    
    // Create list of PDFs
    availablePdfs.forEach(pdf => {
      const pdfItem = document.createElement('div');
      pdfItem.className = 'pdf-item';
      pdfItem.innerHTML = `
        <div><strong>${pdf.name}</strong></div>
        <div class="text-muted small">From: ${pdf.postTitle}</div>
        <button class="btn btn-sm btn-outline-primary mt-2 download-btn" data-url="${pdf.url}" data-filename="${pdf.name}">
          Download
        </button>
      `;
      
      const downloadBtn = pdfItem.querySelector('.download-btn');
      downloadBtn.addEventListener('click', () => {
        downloadFile(pdf.url, pdf.name);
      });
      
      pdfList.appendChild(pdfItem);
    });
  }

  // Download all PDFs
  function downloadAllPdfs() {
    if (isProcessing) {
      alert('Already processing downloads. Please wait for the current operation to complete.');
      return;
    }
    
    downloadQueue = [...availablePdfs];
    downloadProgress.innerHTML = `
      <div class="alert alert-info">
        <div class="d-flex align-items-center">
          <div class="loading"></div>
          <div>Starting downloads...</div>
        </div>
        <div class="mt-2">
          <div class="progress">
            <div class="progress-bar" role="progressbar" style="width: 0%"></div>
          </div>
          <div class="text-center mt-1">0/${downloadQueue.length}</div>
        </div>
      </div>
    `;
    
    processDownloadQueue();
  }

  // Process download queue with rate limiting
  async function processDownloadQueue() {
    if (downloadQueue.length === 0) {
      downloadProgress.innerHTML = `
        <div class="alert alert-success">
          All downloads completed successfully!
        </div>
      `;
      isProcessing = false;
      return;
    }
    
    isProcessing = true;
    const pdf = downloadQueue.shift();
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('.progress .text-center');
    const completedCount = availablePdfs.length - downloadQueue.length;
    const percentage = Math.round((completedCount / availablePdfs.length) * 100);
    
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${completedCount}/${availablePdfs.length}`;
    
    // Update status message
    document.querySelector('.alert-info div:not(.loading)').textContent = `Downloading: ${pdf.name}`;
    
    try {
      await downloadFile(pdf.url, pdf.name);
      
      // Wait 5 seconds between downloads to avoid rate limiting
      setTimeout(() => {
        processDownloadQueue();
      }, 5000);
    } catch (error) {
      console.error('Download error:', error);
      downloadProgress.innerHTML += `
        <div class="alert alert-danger">
          Error downloading ${pdf.name}: ${error.message}
        </div>
      `;
      
      // Continue with next file despite error
      setTimeout(() => {
        processDownloadQueue();
      }, 5000);
    }
  }

  // Download a single file
  async function downloadFile(url, filename) {
    try {
      // Add a status item for this download
      const statusId = 'status-' + Date.now();
      downloadProgress.innerHTML += `
        <div id="${statusId}" class="progress-item alert alert-info">
          <div class="d-flex align-items-center">
            <div class="loading"></div>
            <div>Downloading ${filename}...</div>
          </div>
        </div>
      `;
      
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url, filename })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update status
        const statusElement = document.getElementById(statusId);
        statusElement.className = 'progress-item alert alert-success';
        statusElement.innerHTML = `
          <div class="d-flex justify-content-between align-items-center">
            <div>${filename} downloaded successfully</div>
            <a href="/downloads/${result.path}" class="btn btn-sm btn-outline-primary" download>Download</a>
          </div>
        `;
        
        // Add to downloaded files list
        const fileItem = document.createElement('li');
        fileItem.className = 'list-group-item d-flex justify-content-between align-items-center';
        fileItem.innerHTML = `
          ${filename}
          <a href="/downloads/${result.path}" class="btn btn-sm btn-outline-primary" download>Download</a>
        `;
        downloadedFiles.appendChild(fileItem);
        
        return result;
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      const statusElement = document.getElementById(statusId);
      if (statusElement) {
        statusElement.className = 'progress-item alert alert-danger';
        statusElement.innerHTML = `Failed to download ${filename}: ${error.message}`;
      }
      throw error;
    }
  }
});
