import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html lang="vi">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Khảo Sát Phong Cách Kiến Trúc</title>
        
        {/* TailwindCSS */}
        <script src="https://cdn.tailwindcss.com"></script>
        
        {/* FontAwesome */}
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
        
        {/* Custom CSS */}
        <style>{`
          /* Mobile-first responsive design */
          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
          button, .button { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
          #left-choice, #right-choice { position: relative; cursor: pointer; transition: all 0.2s ease; min-height: 250px; }
          #left-choice:active, #right-choice:active { transform: scale(0.98); opacity: 0.8; }
          #left-choice img, #right-choice img { display: block; width: 100%; height: 100%; object-fit: cover; transition: all 0.3s ease; }
          #left-image, #right-image { width: 100%; height: 256px; object-fit: cover; display: block; }
          #progress-bar { transition: width 0.5s ease-in-out; }
          .animate-spin { animation: spin 1s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @media (max-width: 640px) { 
            button { min-height: 44px; min-width: 44px; }
            #left-choice, #right-choice { min-height: 200px; }
            h1 { font-size: 1.25rem; }
            h2 { font-size: 1.5rem; }
          }
        `}</style>
      </head>
      <body>
        {children}
        
        {/* Inline JavaScript */}
        <script dangerouslySetInnerHTML={{__html: `
          class ArchitectureSurvey {
            constructor() {
              this.sessionId = null;
              this.currentPair = null;
              this.startTime = null;
              this.totalPairs = 0;
              this.maxPairs = 10;
              this.init();
            }

            init() {
              document.getElementById('start-survey')?.addEventListener('click', () => this.startSurvey());
              document.getElementById('left-choice')?.addEventListener('click', () => this.makeChoice('left'));
              document.getElementById('right-choice')?.addEventListener('click', () => this.makeChoice('right'));
              document.getElementById('restart-survey')?.addEventListener('click', () => this.restartSurvey());
              
              if (window.location.pathname === '/admin') {
                this.initAdmin().catch(error => {
                  console.error('Failed to initialize admin:', error);
                });
              }
            }

            async startSurvey() {
              try {
                const response = await fetch('/api/sessions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();
                
                if (data.sessionId) {
                  this.sessionId = data.sessionId;
                  this.showSurveyScreen();
                  await this.loadNextPair();
                } else {
                  alert('Không thể tạo phiên khảo sát. Vui lòng thử lại.');
                }
              } catch (error) {
                console.error('Error starting survey:', error);
                alert('Có lỗi xảy ra. Vui lòng thử lại.');
              }
            }

            async loadNextPair() {
              this.showLoading(true);
              
              try {
                const response = await fetch(\`/api/sessions/\${this.sessionId}/next-pair\`);
                const data = await response.json();
                
                if (data.error) {
                  alert(data.error);
                  return;
                }
                
                this.currentPair = data;
                this.displayImagePair(data.leftImage, data.rightImage);
                this.startTime = Date.now();
                this.showLoading(false);
                
              } catch (error) {
                console.error('Error loading image pair:', error);
                alert('Không thể tải ảnh. Vui lòng thử lại.');
                this.showLoading(false);
              }
            }

            displayImagePair(leftImage, rightImage) {
              console.log('🖼️ displayImagePair called:', {leftImage, rightImage});
              const leftChoice = document.getElementById('left-choice');
              const rightChoice = document.getElementById('right-choice');
              const leftImg = document.getElementById('left-image');
              const rightImg = document.getElementById('right-image');
              
              console.log('🎯 Elements found:', {leftChoice, rightChoice, leftImg, rightImg});
              
              if (!leftChoice || !rightChoice || !leftImg || !rightImg) {
                console.error('❌ Required elements not found!');
                return;
              }
              
              try {
                console.log('📸 Image paths:', {
                  leftPath: leftImage.file_path,
                  rightPath: rightImage.file_path
                });
                
                // Reset container styles to show images properly
                leftChoice.style.background = '';
                leftChoice.style.display = '';
                leftChoice.style.flexDirection = '';
                leftChoice.style.alignItems = '';
                leftChoice.style.justifyContent = '';
                leftChoice.innerHTML = '';
                
                rightChoice.style.background = '';
                rightChoice.style.display = '';
                rightChoice.style.flexDirection = '';
                rightChoice.style.alignItems = '';
                rightChoice.style.justifyContent = '';
                rightChoice.innerHTML = '';
                
                // Re-create the original HTML structure
                leftChoice.innerHTML = \`
                  <img id="left-image" src="" alt="Lựa chọn A" class="w-full h-64 object-cover"/>
                  <div class="absolute inset-0 flex items-end justify-center pb-4">
                    <span class="bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm font-medium">A</span>
                  </div>
                \`;
                
                rightChoice.innerHTML = \`
                  <img id="right-image" src="" alt="Lựa chọn B" class="w-full h-64 object-cover"/>
                  <div class="absolute inset-0 flex items-end justify-center pb-4">
                    <span class="bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm font-medium">B</span>
                  </div>
                \`;
                
                // Get fresh references to the img elements
                const newLeftImg = document.getElementById('left-image');
                const newRightImg = document.getElementById('right-image');
                
                if (!newLeftImg || !newRightImg) {
                  console.error('❌ Could not create new img elements');
                  return;
                }
                
                // Set image sources - try different approaches
                const tryImageSources = (imgElement, image, side) => {
                  const possibleSources = [
                    image.file_path,  // /images/filename.jpg
                    '/static' + image.file_path,  // /static/images/filename.jpg  
                    \`/api/images/\${image.id}\`,  // API endpoint
                    \`data:image/svg+xml;base64,\${btoa('<svg width="400" height="256" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="256" fill="#3B82F6"/><text x="200" y="128" fill="white" text-anchor="middle" font-size="24">' + image.style.toUpperCase() + '</text><text x="200" y="200" fill="white" text-anchor="middle" font-size="16">ID: ' + image.id + '</text></svg>')}\`  // Fallback SVG
                  ];
                  
                  let sourceIndex = 0;
                  
                  const tryNextSource = () => {
                    if (sourceIndex >= possibleSources.length) {
                      console.error(\`❌ All image sources failed for \${side} image\`);
                      return;
                    }
                    
                    const source = possibleSources[sourceIndex];
                    console.log(\`🔄 Trying source \${sourceIndex + 1} for \${side}:\`, source);
                    
                    imgElement.onload = () => {
                      console.log(\`✅ \${side} image loaded successfully with source \${sourceIndex + 1}\`);
                    };
                    
                    imgElement.onerror = () => {
                      console.warn(\`⚠️ \${side} image failed with source \${sourceIndex + 1}, trying next...\`);
                      sourceIndex++;
                      tryNextSource();
                    };
                    
                    imgElement.src = source;
                  };
                  
                  tryNextSource();
                };
                
                // Set up image loading with fallbacks
                tryImageSources(newLeftImg, leftImage, 'Left');
                tryImageSources(newRightImg, rightImage, 'Right');
                
                // Store image data for choice handling
                leftChoice.dataset.imageId = leftImage.id;
                rightChoice.dataset.imageId = rightImage.id;
                
                console.log('🎨 Real images loading initiated');
                
              } catch (error) {
                console.error('Error in displayImagePair:', error);
                // Fallback to style text only
                leftChoice.style.background = '#3B82F6';
                leftChoice.innerHTML = '<div style="color:white;padding:20px;text-align:center;font-size:18px;font-weight:bold;">' + leftImage.style.toUpperCase() + '<br><small>ID: ' + leftImage.id + '</small></div>';
                
                rightChoice.style.background = '#10B981';
                rightChoice.innerHTML = '<div style="color:white;padding:20px;text-align:center;font-size:18px;font-weight:bold;">' + rightImage.style.toUpperCase() + '<br><small>ID: ' + rightImage.id + '</small></div>';
              }
            }

            async makeChoice(side) {
              if (!this.currentPair || !this.startTime) return;
              
              const responseTime = Date.now() - this.startTime;
              const chosenImageId = side === 'left' ? this.currentPair.leftImage.id : this.currentPair.rightImage.id;
              
              try {
                const response = await fetch(\`/api/sessions/\${this.sessionId}/responses\`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    leftImageId: this.currentPair.leftImage.id,
                    rightImageId: this.currentPair.rightImage.id,
                    chosenImageId: chosenImageId,
                    responseTime: responseTime
                  })
                });
                
                const data = await response.json();
                
                if (data.success) {
                  this.totalPairs = data.totalPairs;
                  this.updateProgress();
                  
                  if (data.isComplete) {
                    await this.showResult();
                  } else {
                    setTimeout(() => {
                      this.loadNextPair();
                    }, 500);
                  }
                } else {
                  alert('Không thể lưu lựa chọn. Vui lòng thử lại.');
                }
              } catch (error) {
                console.error('Error saving choice:', error);
                alert('Có lỗi xảy ra khi lưu lựa chọn.');
              }
            }

            async showResult() {
              try {
                const response = await fetch(\`/api/sessions/\${this.sessionId}/result\`);
                const data = await response.json();
                
                if (data.error) {
                  alert(data.error);
                  return;
                }
                
                document.getElementById('dominant-style').textContent = data.dominantStyle;
                document.getElementById('confidence').textContent = \`Độ tin cậy: \${data.confidenceScore}%\`;
                document.getElementById('style-description').textContent = data.description;
                
                const breakdownDiv = document.getElementById('style-breakdown');
                breakdownDiv.innerHTML = '';
                
                Object.entries(data.styleScores).forEach(([style, count]) => {
                  const percentage = Math.round((count / data.totalResponses) * 100);
                  const div = document.createElement('div');
                  div.className = 'flex items-center justify-between text-sm';
                  div.innerHTML = \`
                    <span class="capitalize font-medium">\${style}</span>
                    <div class="flex items-center">
                      <div class="w-20 bg-gray-200 rounded-full h-2 mr-2">
                        <div class="bg-indigo-600 h-2 rounded-full" style="width: \${percentage}%"></div>
                      </div>
                      <span class="text-gray-600">\${count} (\${percentage}%)</span>
                    </div>
                  \`;
                  breakdownDiv.appendChild(div);
                });
                
                this.showScreen('result-screen');
                
              } catch (error) {
                console.error('Error getting result:', error);
                alert('Không thể tải kết quả.');
              }
            }

            updateProgress() {
              const progressText = document.getElementById('progress-text');
              const progressBar = document.getElementById('progress-bar');
              
              progressText.textContent = \`\${this.totalPairs}/\${this.maxPairs}\`;
              
              const percentage = (this.totalPairs / this.maxPairs) * 100;
              progressBar.style.width = \`\${percentage}%\`;
            }

            showSurveyScreen() {
              this.showScreen('survey-screen');
            }

            showScreen(screenId) {
              const screens = ['welcome-screen', 'survey-screen', 'result-screen'];
              screens.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                  element.classList.add('hidden');
                }
              });
              
              const targetScreen = document.getElementById(screenId);
              if (targetScreen) {
                targetScreen.classList.remove('hidden');
              }
            }

            showLoading(show) {
              const loading = document.getElementById('loading');
              const choices = document.querySelectorAll('#left-choice, #right-choice');
              
              if (show) {
                loading?.classList.remove('hidden');
                choices.forEach(choice => choice.style.pointerEvents = 'none');
              } else {
                loading?.classList.add('hidden');
                choices.forEach(choice => choice.style.pointerEvents = 'auto');
              }
            }

            restartSurvey() {
              this.sessionId = null;
              this.currentPair = null;
              this.startTime = null;
              this.totalPairs = 0;
              
              document.getElementById('progress-text').textContent = '0/10';
              document.getElementById('progress-bar').style.width = '0%';
              
              this.showScreen('welcome-screen');
            }

            async initAdmin() {
              // Initialize admin state
              this.selectedImages = new Set();
              this.currentOffset = 0;
              this.currentLimit = 20;
              this.hasMore = true;
              
              // Wait for DOM to be ready
              await new Promise(resolve => setTimeout(resolve, 100));
              
              await this.loadAdminStats();
              await this.loadImageGallery();
              
              // Upload form
              const uploadForm = document.getElementById('upload-form');
              const imageInput = document.getElementById('image-input');
              
              // Debug: Add click listener to label
              const uploadLabel = document.querySelector('label[for="image-input"]');
              uploadLabel?.addEventListener('click', () => {
                console.log('Label clicked, triggering file input');
                imageInput?.click();
              });
              
              // File input change listener
              imageInput?.addEventListener('change', async (e) => {
                console.log('File input changed:', e.target.files);
                if (e.target.files && e.target.files.length > 0) {
                  await this.handleImageUpload(e.target.files);
                }
              });
              
              uploadForm?.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Form submitted with files:', imageInput?.files);
                await this.handleImageUpload(imageInput?.files);
              });
              
              // Test upload button
              document.getElementById('test-upload-btn')?.addEventListener('click', async () => {
                await this.testUpload();
              });

              // Search and filter
              document.getElementById('search-btn')?.addEventListener('click', () => this.searchImages());
              document.getElementById('search-input')?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchImages();
              });
              
              // Auto-filter when dropdowns change
              document.getElementById('style-filter')?.addEventListener('change', () => this.searchImages());
              document.getElementById('status-filter')?.addEventListener('change', () => this.searchImages());

              // Bulk actions
              document.getElementById('bulk-activate')?.addEventListener('click', () => this.bulkAction('activate'));
              document.getElementById('bulk-deactivate')?.addEventListener('click', () => this.bulkAction('deactivate'));
              document.getElementById('bulk-delete')?.addEventListener('click', () => this.bulkAction('delete'));
              document.getElementById('clear-selection')?.addEventListener('click', () => this.clearSelection());
              document.getElementById('delete-all')?.addEventListener('click', () => this.deleteAllImages());

              // Load more
              document.getElementById('load-more-btn')?.addEventListener('click', () => this.loadMoreImages());

              // Modal events
              document.getElementById('close-modal')?.addEventListener('click', () => this.closeEditModal());
              document.getElementById('cancel-edit')?.addEventListener('click', () => this.closeEditModal());
              document.getElementById('close-details-modal')?.addEventListener('click', () => this.closeDetailsModal());
              document.getElementById('edit-form')?.addEventListener('submit', (e) => this.handleEditSubmit(e));
            }

            async loadAdminStats() {
              try {
                const response = await fetch('/api/admin/stats');
                const data = await response.json();
                
                document.getElementById('total-sessions').textContent = data.totalCompletedSessions || 0;
                document.getElementById('total-images').textContent = data.totalActiveImages || 0;
                
                if (data.stylePopularity && data.stylePopularity.length > 0) {
                  document.getElementById('popular-style').textContent = data.stylePopularity[0].style || '-';
                }
                
              } catch (error) {
                console.error('Error loading admin stats:', error);
              }
            }

            async testUpload() {
              try {
                // Create a small test image as blob
                const canvas = document.createElement('canvas');
                canvas.width = 100;
                canvas.height = 100;
                const ctx = canvas.getContext('2d');
                
                // Draw a simple test image
                ctx.fillStyle = '#' + Math.floor(Math.random()*16777215).toString(16);
                ctx.fillRect(0, 0, 100, 100);
                ctx.fillStyle = 'white';
                ctx.font = '14px Arial';
                ctx.fillText('TEST', 30, 55);
                
                // Convert to blob
                const blob = await new Promise(resolve => {
                  canvas.toBlob(resolve, 'image/png');
                });
                
                // Create file with random style name
                const styles = ['modern', 'classical', 'minimalist', 'industrial', 'traditional'];
                const randomStyle = styles[Math.floor(Math.random() * styles.length)];
                const timestamp = Date.now();
                const filename = \`test_\${randomStyle}_architecture_\${timestamp}.png\`;
                
                const testFile = new File([blob], filename, { type: 'image/png' });
                
                // Upload using existing function
                await this.handleImageUpload([testFile]);
                
              } catch (error) {
                console.error('Error creating test upload:', error);
                alert('Không thể tạo test upload');
              }
            }

            async handleImageUpload(files) {
              if (!files || files.length === 0) {
                alert('Vui lòng chọn ít nhất một ảnh');
                return;
              }
              
              try {
                for (const file of files) {
                  const formData = new FormData();
                  formData.append('image', file);
                  
                  const response = await fetch('/api/admin/upload', {
                    method: 'POST',
                    body: formData
                  });
                  
                  const result = await response.json();
                  
                  if (result.success) {
                    console.log(\`Uploaded \${file.name} as \${result.style} style\`);
                  } else {
                    console.error(\`Failed to upload \${file.name}:\`, result.error);
                  }
                }
                
                await this.loadAdminStats();
                await this.loadImageGallery();
                const imageInput = document.getElementById('image-input');
                if (imageInput) imageInput.value = '';
                alert('Upload thành công!');
                
              } catch (error) {
                console.error('Error uploading images:', error);
                alert('Có lỗi xảy ra khi upload ảnh');
              }
            }

            async loadImageGallery() {
              try {
                const params = this.getSearchParams();
                const response = await fetch(\`/api/admin/images/search?\${params}\`);
                const data = await response.json();
                
                if (this.currentOffset === 0) {
                  // Reset gallery if this is a new search
                  const gallery = document.getElementById('image-gallery');
                  if (gallery) {
                    gallery.innerHTML = '';
                  }
                  this.selectedImages.clear();
                  this.updateBulkActions();
                }
                
                this.hasMore = data.hasMore;
                this.displayImages(data.images || []);
                this.updateLoadMoreButton();
                
                if (data.total === 0) {
                  this.showEmptyState();
                } else {
                  this.hideEmptyState();
                }
                
              } catch (error) {
                console.error('Error loading image gallery:', error);
                this.showEmptyState();
              }
            }

            getSearchParams() {
              const search = document.getElementById('search-input')?.value || '';
              const style = document.getElementById('style-filter')?.value || 'all';
              const status = document.getElementById('status-filter')?.value || 'all';
              
              return new URLSearchParams({
                search,
                style,
                status,
                limit: this.currentLimit.toString(),
                offset: this.currentOffset.toString()
              }).toString();
            }

            displayImages(images) {
              const gallery = document.getElementById('image-gallery');
              
              if (!gallery) {
                console.error('Gallery element not found');
                return;
              }
              
              images.forEach((image, index) => {
                const div = document.createElement('div');
                div.className = 'relative group bg-gray-100 rounded-lg overflow-hidden aspect-square cursor-pointer hover:shadow-lg transition-all';
                
                // Try to use real image first, fallback to placeholder
                const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
                const placeholderColor = colors[image.id % colors.length];
                
                // Possible image sources
                const imageSources = [
                  \`/api/images/\${image.id}\`,  // API endpoint with fallback
                  image.file_path,  // Direct file path
                  '/static' + image.file_path  // Static serving
                ];
                
                // Rút gọn filename nếu quá dài
                const shortFilename = image.filename.length > 20 ? 
                  image.filename.substring(0, 17) + '...' : image.filename;
                
                // Create SVG without special chars to avoid btoa encoding issues
                const safeStyle = image.style.replace(/[^\x20-\x7E]/g, ''); // Keep only printable ASCII
                const safeFilename = shortFilename.replace(/[^\x20-\x7E]/g, ''); // Keep only printable ASCII
                const statusText = image.is_active ? 'Active' : 'Inactive';
                
                const svgContent = \`<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="grad\${image.id}" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style="stop-color:\${placeholderColor};stop-opacity:1" />
                      <stop offset="100%" style="stop-color:\${placeholderColor}CC;stop-opacity:1" />
                    </linearGradient>
                  </defs>
                  <rect width="300" height="300" fill="url(#grad\${image.id})"/>
                  <circle cx="150" cy="100" r="30" fill="rgba(255,255,255,0.2)"/>
                  <rect x="135" y="88" width="30" height="20" rx="4" fill="white" opacity="0.8"/>
                  <circle cx="142" cy="93" r="2" fill="\${placeholderColor}"/>
                  <rect x="148" y="95" width="12" height="8" rx="1" fill="\${placeholderColor}"/>
                  <text x="150" y="140" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" font-weight="bold">\${safeStyle.toUpperCase()}</text>
                  <text x="150" y="160" font-family="Arial, sans-serif" font-size="11" fill="white" text-anchor="middle" opacity="0.9">ID: \${image.id}</text>
                  <text x="150" y="180" font-family="Arial, sans-serif" font-size="10" fill="white" text-anchor="middle" opacity="0.8">\${safeFilename}</text>
                  <text x="150" y="200" font-family="Arial, sans-serif" font-size="9" fill="white" text-anchor="middle" opacity="0.7">\${statusText}</text>
                </svg>\`;
                
                const placeholderSvg = \`data:image/svg+xml;base64,\${btoa(svgContent)}\`;
                
                div.innerHTML = \`
                  <input type="checkbox" class="image-checkbox absolute top-2 left-2 z-10 rounded" data-image-id="\${image.id}" />
                  <img src="\${imageSources[0]}" 
                       alt="\${image.style}" 
                       class="w-full h-full object-cover"
                       onError="this.onerror=null; this.src='\${imageSources[1]}'; if(this.complete && this.naturalWidth===0) this.src='\${imageSources[2]}';">
                  <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-end">
                    <div class="p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity w-full">
                      <div class="flex items-center justify-between">
                        <div>
                          <p class="font-medium capitalize text-sm">\${image.style}</p>
                          <p class="text-xs opacity-75 truncate">\${image.filename}</p>
                        </div>
                        <div class="flex space-x-1">
                          <button class="edit-btn bg-blue-600 hover:bg-blue-700 p-1 rounded text-xs" data-image-id="\${image.id}">
                            <i class="fas fa-edit"></i>
                          </button>
                          <button class="details-btn bg-green-600 hover:bg-green-700 p-1 rounded text-xs" data-image-id="\${image.id}">
                            <i class="fas fa-info"></i>
                          </button>
                          <button class="toggle-btn bg-\${image.is_active ? 'yellow' : 'gray'}-600 hover:bg-\${image.is_active ? 'yellow' : 'gray'}-700 p-1 rounded text-xs" data-image-id="\${image.id}">
                            <i class="fas fa-\${image.is_active ? 'eye-slash' : 'eye'}"></i>
                          </button>
                          <button class="delete-btn bg-red-600 hover:bg-red-700 p-1 rounded text-xs" data-image-id="\${image.id}">
                            <i class="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  \${!image.is_active ? '<div class="absolute inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center"><span class="text-white text-sm font-medium">Đã tắt</span></div>' : ''}
                \`;
                
                // Add event listeners immediately after creating the element
                const checkbox = div.querySelector('.image-checkbox');
                const editBtn = div.querySelector('.edit-btn');
                const detailsBtn = div.querySelector('.details-btn');
                const toggleBtn = div.querySelector('.toggle-btn');
                const deleteBtn = div.querySelector('.delete-btn');
                
                // Add debug logging for delete button
                console.log('🔧 Setting up button listeners for image', image.id, {
                  checkbox, editBtn, detailsBtn, toggleBtn, deleteBtn
                });
                
                if (checkbox) {
                  checkbox.addEventListener('change', (e) => {
                    console.log('📋 Checkbox changed for image', image.id, 'checked:', e.target.checked);
                    this.toggleImageSelection(image.id.toString(), e.target.checked);
                  });
                }
                
                if (editBtn) {
                  editBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('✏️ Edit button clicked for image', image.id);
                    this.editImage(image.id);
                  });
                }
                
                if (detailsBtn) {
                  detailsBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('ℹ️ Details button clicked for image', image.id);
                    this.showImageDetails(image.id);
                  });
                }
                
                if (toggleBtn) {
                  toggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('👁️ Toggle button clicked for image', image.id);
                    this.toggleImageStatus(image.id);
                  });
                }
                
                if (deleteBtn) {
                  deleteBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🗑️ Delete button clicked for image', image.id);
                    this.deleteImage(image.id);
                  });
                } else {
                  console.error('❌ Delete button not found for image', image.id);
                }
                
                gallery.appendChild(div);
              });
              
              this.hideEmptyState();
            }

            toggleImageSelection(imageId, checked) {
              console.log('🔄 toggleImageSelection:', imageId, checked);
              if (checked) {
                this.selectedImages.add(imageId);
                console.log('➕ Added image to selection:', imageId);
              } else {
                this.selectedImages.delete(imageId);
                console.log('➖ Removed image from selection:', imageId);
              }
              console.log('📊 Current selection:', Array.from(this.selectedImages));
              this.updateBulkActions();
            }

            updateBulkActions() {
              const count = this.selectedImages.size;
              const bulkActions = document.getElementById('bulk-actions');
              const selectedCount = document.getElementById('selected-count');
              
              if (count > 0) {
                bulkActions?.classList.remove('hidden');
                selectedCount.textContent = \`\${count} ảnh được chọn\`;
              } else {
                bulkActions?.classList.add('hidden');
              }
            }

            clearSelection() {
              this.selectedImages.clear();
              document.querySelectorAll('.image-checkbox').forEach(cb => cb.checked = false);
              this.updateBulkActions();
            }

            async searchImages() {
              this.currentOffset = 0;
              await this.loadImageGallery();
            }

            async loadMoreImages() {
              this.currentOffset += this.currentLimit;
              await this.loadImageGallery();
            }

            updateLoadMoreButton() {
              const container = document.getElementById('load-more-container');
              if (this.hasMore) {
                container?.classList.remove('hidden');
              } else {
                container?.classList.add('hidden');
              }
            }

            showEmptyState() {
              document.getElementById('empty-state')?.classList.remove('hidden');
            }

            hideEmptyState() {
              document.getElementById('empty-state')?.classList.add('hidden');
            }

            async editImage(imageId) {
              try {
                const response = await fetch(\`/api/admin/images/\${imageId}\`);
                const data = await response.json();
                
                if (data.image) {
                  document.getElementById('edit-image-id').value = imageId;
                  document.getElementById('edit-filename').value = data.image.filename;
                  document.getElementById('edit-style').value = data.image.style;
                  document.getElementById('edit-original-name').value = data.image.original_name;
                  document.getElementById('edit-is-active').checked = data.image.is_active;
                  
                  document.getElementById('edit-modal')?.classList.remove('hidden');
                }
              } catch (error) {
                console.error('Error loading image for edit:', error);
                alert('Không thể tải thông tin ảnh');
              }
            }

            async handleEditSubmit(e) {
              e.preventDefault();
              
              const imageId = document.getElementById('edit-image-id').value;
              const filename = document.getElementById('edit-filename').value;
              const style = document.getElementById('edit-style').value;
              const originalName = document.getElementById('edit-original-name').value;
              const isActive = document.getElementById('edit-is-active').checked;
              
              try {
                const response = await fetch(\`/api/admin/images/\${imageId}\`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    filename,
                    style,
                    original_name: originalName,
                    is_active: isActive
                  })
                });
                
                const result = await response.json();
                
                if (result.success) {
                  this.closeEditModal();
                  await this.loadImageGallery();
                  alert('Cập nhật thành công!');
                } else {
                  alert(result.error || 'Có lỗi xảy ra');
                }
              } catch (error) {
                console.error('Error updating image:', error);
                alert('Có lỗi xảy ra khi cập nhật');
              }
            }

            closeEditModal() {
              document.getElementById('edit-modal')?.classList.add('hidden');
            }

            async showImageDetails(imageId) {
              try {
                const response = await fetch(\`/api/admin/images/\${imageId}\`);
                const data = await response.json();
                
                if (data.image && data.stats) {
                  const content = document.getElementById('image-details-content');
                  content.innerHTML = \`
                    <div class="space-y-4">
                      <div class="text-center">
                        <div class="w-32 h-32 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg mx-auto mb-3 flex items-center justify-center">
                          <div class="text-white text-center">
                            <i class="fas fa-image text-2xl mb-2"></i>
                            <p class="text-xs capitalize">\${data.image.style}</p>
                          </div>
                        </div>
                        <h4 class="text-lg font-medium">\${data.image.filename}</h4>
                        <p class="text-sm text-gray-500 capitalize">\${data.image.style} style</p>
                      </div>
                      
                      <div class="border-t pt-4">
                        <h5 class="font-medium mb-2">Thống kê sử dụng:</h5>
                        <div class="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span class="text-gray-600">Số lần xuất hiện:</span>
                            <span class="font-medium ml-1">\${data.stats.total_appearances}</span>
                          </div>
                          <div>
                            <span class="text-gray-600">Số lần được chọn:</span>
                            <span class="font-medium ml-1">\${data.stats.times_chosen}</span>
                          </div>
                          <div class="col-span-2">
                            <span class="text-gray-600">Tỷ lệ được chọn:</span>
                            <span class="font-medium ml-1">\${data.stats.choice_rate}%</span>
                          </div>
                        </div>
                      </div>
                      
                      <div class="border-t pt-4">
                        <h5 class="font-medium mb-2">Chi tiết:</h5>
                        <div class="text-sm space-y-1">
                          <div><span class="text-gray-600">Tên gốc:</span> \${data.image.original_name}</div>
                          <div><span class="text-gray-600">Trạng thái:</span> 
                            <span class="inline-flex px-2 py-1 text-xs rounded-full \${data.image.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                              \${data.image.is_active ? 'Hoạt động' : 'Đã tắt'}
                            </span>
                          </div>
                          <div><span class="text-gray-600">Upload:</span> \${new Date(data.image.uploaded_at).toLocaleDateString('vi-VN')}</div>
                        </div>
                      </div>
                    </div>
                  \`;
                  
                  document.getElementById('details-modal')?.classList.remove('hidden');
                }
              } catch (error) {
                console.error('Error loading image details:', error);
                alert('Không thể tải chi tiết ảnh');
              }
            }

            closeDetailsModal() {
              document.getElementById('details-modal')?.classList.add('hidden');
            }

            async toggleImageStatus(imageId) {
              try {
                const response = await fetch(\`/api/admin/images/\${imageId}/toggle\`, {
                  method: 'PATCH'
                });
                
                const result = await response.json();
                
                if (result.success) {
                  await this.loadImageGallery();
                  alert(result.message);
                } else {
                  alert(result.error || 'Có lỗi xảy ra');
                }
              } catch (error) {
                console.error('Error toggling image status:', error);
                alert('Có lỗi xảy ra');
              }
            }

            async deleteImage(imageId) {
              console.log('🗑️ deleteImage called with ID:', imageId);
              
              if (!confirm(\`Bạn có chắc muốn xóa ảnh có ID \${imageId}?\`)) {
                console.log('❌ User cancelled delete operation');
                return;
              }
              
              console.log('✅ User confirmed delete, proceeding...');
              
              try {
                console.log('📡 Calling DELETE API for image', imageId);
                const response = await fetch(\`/api/admin/images/\${imageId}\`, {
                  method: 'DELETE'
                });
                
                console.log('📥 API response status:', response.status);
                const result = await response.json();
                console.log('📊 API result:', result);
                
                if (result.success) {
                  console.log('✅ Delete successful, refreshing gallery...');
                  await this.loadImageGallery();
                  await this.loadAdminStats();
                  alert(result.message || 'Xóa ảnh thành công!');
                } else {
                  console.error('❌ Delete failed:', result.error);
                  alert(result.error || 'Có lỗi xảy ra');
                }
              } catch (error) {
                console.error('💥 Error deleting image:', error);
                alert('Có lỗi xảy ra khi xóa ảnh');
              }
            }

            async bulkAction(action) {
              if (this.selectedImages.size === 0) {
                alert('Vui lòng chọn ít nhất một ảnh');
                return;
              }
              
              const actionText = {
                'activate': 'kích hoạt',
                'deactivate': 'tắt',
                'delete': 'xóa'
              }[action];
              
              if (!confirm(\`Bạn có chắc muốn \${actionText} \${this.selectedImages.size} ảnh đã chọn?\`)) return;
              
              try {
                // Convert selectedImages to numbers and log for debugging
                const imageIds = Array.from(this.selectedImages).map(id => parseInt(id));
                console.log('🗑️ Bulk action:', action, 'for images:', imageIds);
                
                const requestBody = {
                  action,
                  imageIds
                };
                console.log('📤 Request body:', requestBody);
                
                const response = await fetch('/api/admin/images/bulk', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestBody)
                });
                
                console.log('📥 Bulk API response status:', response.status);
                const result = await response.json();
                console.log('📊 Bulk API result:', result);
                
                if (result.success) {
                  console.log('✅ Bulk action successful');
                  this.clearSelection();
                  await this.loadImageGallery();
                  await this.loadAdminStats();
                  alert(result.message);
                } else {
                  console.error('❌ Bulk action failed:', result.error);
                  alert(result.error || 'Failed to perform bulk action');
                }
              } catch (error) {
                console.error('💥 Error performing bulk action:', error);
                alert('Có lỗi xảy ra khi thực hiện bulk action');
              }
            }

            async deleteAllImages() {
              console.log('🚨 Delete all images requested');
              
              // Show confirmation dialog
              const confirmation = confirm(
                '⚠️ CẢNH BÁO: Bạn có chắc chắn muốn xóa TẤT CẢ ảnh?\n\n' +
                '• Nếu có survey responses: Tất cả ảnh sẽ bị DEACTIVATE\n' +
                '• Nếu không có responses: Tất cả ảnh sẽ bị XÓA HOÀN TOÀN\n\n' +
                'Hành động này KHÔNG THỂ HOÀN TÁC!'
              );
              
              if (!confirmation) {
                console.log('❌ Delete all cancelled by user');
                return;
              }

              // Double confirmation for safety
              const doubleConfirm = confirm(
                '🔴 LẦN CUỐI: Bạn THẬT SỤ muốn xóa tất cả ảnh?\n\n' +
                'Nhấn OK để tiếp tục, Cancel để hủy bỏ.'
              );

              if (!doubleConfirm) {
                console.log('❌ Delete all cancelled on double confirmation');
                return;
              }

              try {
                console.log('🗑️ Proceeding with delete all...');
                const response = await fetch('/api/admin/images/all', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' }
                });

                const result = await response.json();
                console.log('📊 Delete all result:', result);

                if (result.success) {
                  console.log('✅ Delete all successful');
                  await this.loadImageGallery();
                  await this.loadAdminStats();
                  alert('Thành công: ' + result.message);
                } else {
                  console.error('❌ Delete all failed:', result.error);
                  alert(result.error || 'Failed to delete all images');
                }
              } catch (error) {
                console.error('💥 Error deleting all images:', error);
                alert('Có lỗi xảy ra khi xóa tất cả ảnh');
              }
            }
          }

          document.addEventListener('DOMContentLoaded', () => {
            const survey = new ArchitectureSurvey();
            
            // Auto-start survey for testing
            if (window.location.search.includes('autostart')) {
              setTimeout(() => {
                console.log('🧪 Auto-starting survey for testing...');
                survey.startSurvey();
              }, 1000);
            }
          });
        `}} />
      </body>
    </html>
  )
})
