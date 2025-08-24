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
          #left-choice img, #right-image img { display: block; width: 100%; height: 100%; object-fit: cover; transition: all 0.3s ease; }
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
                this.initAdmin();
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
              const leftImg = document.getElementById('left-image');
              const rightImg = document.getElementById('right-image');
              
              leftImg.src = \`https://picsum.photos/400/400?random=\${leftImage.id}\`;
              rightImg.src = \`https://picsum.photos/400/400?random=\${rightImage.id}\`;
              
              leftImg.alt = \`\${leftImage.style} architecture\`;
              rightImg.alt = \`\${rightImage.style} architecture\`;
              
              leftImg.dataset.imageId = leftImage.id;
              rightImg.dataset.imageId = rightImage.id;
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
              
              await this.loadAdminStats();
              await this.loadImageGallery();
              
              // Upload form
              const uploadForm = document.getElementById('upload-form');
              const imageInput = document.getElementById('image-input');
              
              uploadForm?.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleImageUpload(imageInput.files);
              });

              // Search and filter
              document.getElementById('search-btn')?.addEventListener('click', () => this.searchImages());
              document.getElementById('search-input')?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchImages();
              });

              // Bulk actions
              document.getElementById('bulk-activate')?.addEventListener('click', () => this.bulkAction('activate'));
              document.getElementById('bulk-deactivate')?.addEventListener('click', () => this.bulkAction('deactivate'));
              document.getElementById('bulk-delete')?.addEventListener('click', () => this.bulkAction('delete'));
              document.getElementById('clear-selection')?.addEventListener('click', () => this.clearSelection());

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
                document.getElementById('image-input').value = '';
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
                  document.getElementById('image-gallery').innerHTML = '';
                  this.selectedImages.clear();
                  this.updateBulkActions();
                }
                
                this.hasMore = data.hasMore;
                this.displayImages(data.images);
                this.updateLoadMoreButton();
                
                if (data.total === 0) {
                  this.showEmptyState();
                }
                
              } catch (error) {
                console.error('Error loading image gallery:', error);
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
              
              images.forEach(image => {
                const div = document.createElement('div');
                div.className = 'relative group bg-gray-100 rounded-lg overflow-hidden aspect-square cursor-pointer hover:shadow-lg transition-all';
                div.innerHTML = \`
                  <input type="checkbox" class="image-checkbox absolute top-2 left-2 z-10 rounded" data-image-id="\${image.id}" />
                  <img src="https://picsum.photos/300/300?random=\${image.id}" 
                       alt="\${image.style}" 
                       class="w-full h-full object-cover">
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
                
                // Add event listeners
                const checkbox = div.querySelector('.image-checkbox');
                const editBtn = div.querySelector('.edit-btn');
                const detailsBtn = div.querySelector('.details-btn');
                const toggleBtn = div.querySelector('.toggle-btn');
                const deleteBtn = div.querySelector('.delete-btn');
                
                checkbox?.addEventListener('change', (e) => this.toggleImageSelection(e.target.dataset.imageId, e.target.checked));
                editBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.editImage(e.target.dataset.imageId); });
                detailsBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.showImageDetails(e.target.dataset.imageId); });
                toggleBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.toggleImageStatus(e.target.dataset.imageId); });
                deleteBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.deleteImage(e.target.dataset.imageId); });
                
                gallery.appendChild(div);
              });
              
              this.hideEmptyState();
            }

            toggleImageSelection(imageId, checked) {
              if (checked) {
                this.selectedImages.add(imageId);
              } else {
                this.selectedImages.delete(imageId);
              }
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
                        <img src="https://picsum.photos/200/200?random=\${data.image.id}" 
                             alt="\${data.image.style}" 
                             class="w-32 h-32 object-cover rounded-lg mx-auto mb-3">
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
              if (!confirm('Bạn có chắc muốn xóa ảnh này?')) return;
              
              try {
                const response = await fetch(\`/api/admin/images/\${imageId}\`, {
                  method: 'DELETE'
                });
                
                const result = await response.json();
                
                if (result.success) {
                  await this.loadImageGallery();
                  await this.loadAdminStats();
                  alert(result.message);
                } else {
                  alert(result.error || 'Có lỗi xảy ra');
                }
              } catch (error) {
                console.error('Error deleting image:', error);
                alert('Có lỗi xảy ra');
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
                const response = await fetch('/api/admin/images/bulk', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action,
                    imageIds: Array.from(this.selectedImages)
                  })
                });
                
                const result = await response.json();
                
                if (result.success) {
                  this.clearSelection();
                  await this.loadImageGallery();
                  await this.loadAdminStats();
                  alert(result.message);
                } else {
                  alert(result.error || 'Có lỗi xảy ra');
                }
              } catch (error) {
                console.error('Error performing bulk action:', error);
                alert('Có lỗi xảy ra');
              }
            }
          }

          document.addEventListener('DOMContentLoaded', () => {
            new ArchitectureSurvey();
          });
        `}} />
      </body>
    </html>
  )
})
