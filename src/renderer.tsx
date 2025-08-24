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
              await this.loadAdminStats();
              
              const uploadForm = document.getElementById('upload-form');
              const imageInput = document.getElementById('image-input');
              
              uploadForm?.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleImageUpload(imageInput.files);
              });
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
                document.getElementById('image-input').value = '';
                alert('Upload thành công!');
                
              } catch (error) {
                console.error('Error uploading images:', error);
                alert('Có lỗi xảy ra khi upload ảnh');
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
