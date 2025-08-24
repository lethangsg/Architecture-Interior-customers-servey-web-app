// Architecture Survey App - Frontend Logic

class ArchitectureSurvey {
  constructor() {
    this.sessionId = null
    this.currentPair = null
    this.startTime = null
    this.totalPairs = 0
    this.maxPairs = 10
    
    this.init()
  }

  init() {
    // Bind event listeners
    document.getElementById('start-survey')?.addEventListener('click', () => this.startSurvey())
    document.getElementById('left-choice')?.addEventListener('click', () => this.makeChoice('left'))
    document.getElementById('right-choice')?.addEventListener('click', () => this.makeChoice('right'))
    document.getElementById('restart-survey')?.addEventListener('click', () => this.restartSurvey())
    
    // Check if we're on admin page
    if (window.location.pathname === '/admin') {
      this.initAdmin()
    }
  }

  async startSurvey() {
    try {
      // Create new session
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      
      if (data.sessionId) {
        this.sessionId = data.sessionId
        this.showSurveyScreen()
        await this.loadNextPair()
      } else {
        this.showError('Không thể tạo phiên khảo sát. Vui lòng thử lại.')
      }
    } catch (error) {
      console.error('Error starting survey:', error)
      this.showError('Có lỗi xảy ra. Vui lòng thử lại.')
    }
  }

  async loadNextPair() {
    this.showLoading(true)
    
    try {
      const response = await fetch(`/api/sessions/${this.sessionId}/next-pair`)
      const data = await response.json()
      
      if (data.error) {
        this.showError(data.error)
        return
      }
      
      this.currentPair = data
      this.displayImagePair(data.leftImage, data.rightImage)
      this.startTime = Date.now()
      this.showLoading(false)
      
    } catch (error) {
      console.error('Error loading image pair:', error)
      this.showError('Không thể tải ảnh. Vui lòng thử lại.')
      this.showLoading(false)
    }
  }

  displayImagePair(leftImage, rightImage) {
    const leftImg = document.getElementById('left-image')
    const rightImg = document.getElementById('right-image')
    
    // Sử dụng API endpoint để lấy ảnh thực tế hoặc SVG fallback
    leftImg.src = `/api/images/${leftImage.id}`
    rightImg.src = `/api/images/${rightImage.id}`
    
    leftImg.alt = `${leftImage.style} architecture`
    rightImg.alt = `${rightImage.style} architecture`
    
    // Store image data for choice handling
    leftImg.dataset.imageId = leftImage.id
    rightImg.dataset.imageId = rightImage.id
  }

  async makeChoice(side) {
    if (!this.currentPair || !this.startTime) return
    
    const responseTime = Date.now() - this.startTime
    const chosenImageId = side === 'left' ? this.currentPair.leftImage.id : this.currentPair.rightImage.id
    
    try {
      const response = await fetch(`/api/sessions/${this.sessionId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leftImageId: this.currentPair.leftImage.id,
          rightImageId: this.currentPair.rightImage.id,
          chosenImageId: chosenImageId,
          responseTime: responseTime
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        this.totalPairs = data.totalPairs
        this.updateProgress()
        
        if (data.isComplete) {
          await this.showResult()
        } else {
          // Load next pair after a short delay
          setTimeout(() => {
            this.loadNextPair()
          }, 500)
        }
      } else {
        this.showError('Không thể lưu lựa chọn. Vui lòng thử lại.')
      }
    } catch (error) {
      console.error('Error saving choice:', error)
      this.showError('Có lỗi xảy ra khi lưu lựa chọn.')
    }
  }

  async showResult() {
    try {
      const response = await fetch(`/api/sessions/${this.sessionId}/result`)
      const data = await response.json()
      
      if (data.error) {
        this.showError(data.error)
        return
      }
      
      // Display result
      document.getElementById('dominant-style').textContent = data.dominantStyle
      document.getElementById('confidence').textContent = `Độ tin cậy: ${data.confidenceScore}%`
      document.getElementById('style-description').textContent = data.description
      
      // Display style breakdown
      const breakdownDiv = document.getElementById('style-breakdown')
      breakdownDiv.innerHTML = ''
      
      Object.entries(data.styleScores).forEach(([style, count]) => {
        const percentage = Math.round((count / data.totalResponses) * 100)
        const div = document.createElement('div')
        div.className = 'flex items-center justify-between text-sm'
        div.innerHTML = `
          <span class="capitalize font-medium">${style}</span>
          <div class="flex items-center">
            <div class="w-20 bg-gray-200 rounded-full h-2 mr-2">
              <div class="bg-indigo-600 h-2 rounded-full" style="width: ${percentage}%"></div>
            </div>
            <span class="text-gray-600">${count} (${percentage}%)</span>
          </div>
        `
        breakdownDiv.appendChild(div)
      })
      
      this.showScreen('result-screen')
      
    } catch (error) {
      console.error('Error getting result:', error)
      this.showError('Không thể tải kết quả.')
    }
  }

  updateProgress() {
    const progressText = document.getElementById('progress-text')
    const progressBar = document.getElementById('progress-bar')
    
    progressText.textContent = `${this.totalPairs}/${this.maxPairs}`
    
    const percentage = (this.totalPairs / this.maxPairs) * 100
    progressBar.style.width = `${percentage}%`
  }

  showSurveyScreen() {
    this.showScreen('survey-screen')
  }

  showScreen(screenId) {
    // Hide all screens
    const screens = ['welcome-screen', 'survey-screen', 'result-screen']
    screens.forEach(id => {
      const element = document.getElementById(id)
      if (element) {
        element.classList.add('hidden')
      }
    })
    
    // Show target screen
    const targetScreen = document.getElementById(screenId)
    if (targetScreen) {
      targetScreen.classList.remove('hidden')
    }
  }

  showLoading(show) {
    const loading = document.getElementById('loading')
    const choices = document.querySelectorAll('#left-choice, #right-choice')
    
    if (show) {
      loading?.classList.remove('hidden')
      choices.forEach(choice => choice.style.pointerEvents = 'none')
    } else {
      loading?.classList.add('hidden')
      choices.forEach(choice => choice.style.pointerEvents = 'auto')
    }
  }

  showError(message) {
    // Simple error display - could be enhanced with better UI
    alert(message)
  }

  restartSurvey() {
    this.sessionId = null
    this.currentPair = null
    this.startTime = null
    this.totalPairs = 0
    
    // Reset progress
    document.getElementById('progress-text').textContent = '0/10'
    document.getElementById('progress-bar').style.width = '0%'
    
    this.showScreen('welcome-screen')
  }

  // Admin functionality
  async initAdmin() {
    await this.loadAdminStats()
    await this.loadImageGallery()
    
    // Setup upload form
    const uploadForm = document.getElementById('upload-form')
    const imageInput = document.getElementById('image-input')
    
    uploadForm?.addEventListener('submit', async (e) => {
      e.preventDefault()
      await this.handleImageUpload(imageInput.files)
    })
    
    imageInput?.addEventListener('change', (e) => {
      const files = e.target.files
      if (files.length > 0) {
        // Show selected files info
        const fileNames = Array.from(files).map(f => f.name).join(', ')
        console.log('Selected files:', fileNames)
      }
    })
  }

  async loadAdminStats() {
    try {
      const response = await fetch('/api/admin/stats')
      const data = await response.json()
      
      document.getElementById('total-sessions').textContent = data.totalCompletedSessions || 0
      document.getElementById('total-images').textContent = data.totalActiveImages || 0
      
      if (data.stylePopularity && data.stylePopularity.length > 0) {
        document.getElementById('popular-style').textContent = data.stylePopularity[0].style || '-'
        this.displayStyleChart(data.stylePopularity)
      }
      
    } catch (error) {
      console.error('Error loading admin stats:', error)
    }
  }

  async loadImageGallery() {
    try {
      const response = await fetch('/api/admin/images')
      const data = await response.json()
      
      const gallery = document.getElementById('image-gallery')
      gallery.innerHTML = ''
      
      if (data.images && data.images.length > 0) {
        data.images.forEach((image, index) => {
          // Create Pinterest-style card
          const card = document.createElement('div')
          
          // Add random height variation for Pinterest effect
          const heightClasses = ['tall', 'medium', 'short']
          const randomHeight = heightClasses[index % 3]
          
          card.className = `pinterest-card ${randomHeight}`
          card.dataset.imageId = image.id
          
          card.innerHTML = `
            <button class="pinterest-pin-btn">
              <i class="fas fa-thumbtack mr-1"></i>
              Pin
            </button>
            
            <img src="/api/images/${image.id}" 
                 alt="${image.style}" 
                 class="pinterest-card-image"
                 style="height: ${this.getPinterestHeight(index)}px"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"
                 onload="this.classList.add('loaded')">
            
            <div class="w-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg" 
                 style="display:none; height: ${this.getPinterestHeight(index)}px">
              <i class="fas fa-building mr-2"></i>
              ${image.style.toUpperCase()}
            </div>
            
            <div class="pinterest-card-overlay">
              <div class="pinterest-card-actions">
                <button class="pinterest-action-btn edit-btn" data-id="${image.id}" title="Edit Image">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="pinterest-action-btn toggle-btn" data-id="${image.id}" title="${image.is_active ? 'Deactivate' : 'Activate'}">
                  <i class="fas fa-${image.is_active ? 'eye-slash' : 'eye'}"></i>
                </button>
                <button class="pinterest-action-btn delete-btn" data-id="${image.id}" title="Delete Image">
                  <i class="fas fa-trash"></i>
                </button>
                <button class="pinterest-action-btn info-btn" data-id="${image.id}" title="View Details">
                  <i class="fas fa-info"></i>
                </button>
              </div>
              
              <div class="pinterest-card-title">
                ${image.style.toUpperCase()}
                <div style="font-size: 10px; opacity: 0.8; font-weight: normal; margin-top: 2px;">
                  ID: ${image.id} • ${image.filename.length > 20 ? image.filename.substring(0, 20) + '...' : image.filename}
                </div>
              </div>
            </div>
            
            <div class="pinterest-status-badge ${image.is_active ? 'active' : 'inactive'}">
              ${image.is_active ? '✓ Active' : '⏸ Inactive'}
            </div>
          `
          
          // Add click handler for image details
          card.addEventListener('click', (e) => {
            // Only show details if not clicking on action buttons
            if (!e.target.closest('.pinterest-action-btn')) {
              this.showImageDetails(image.id)
            }
          })
          
          // Add event listeners for action buttons
          card.querySelector('.pinterest-pin-btn')?.addEventListener('click', (e) => {
            e.stopPropagation()
            this.pinImage(image.id, card)
          })
          
          card.querySelector('.edit-btn')?.addEventListener('click', (e) => {
            e.stopPropagation()
            this.editImage(image.id)
          })
          
          card.querySelector('.toggle-btn')?.addEventListener('click', (e) => {
            e.stopPropagation()
            this.toggleImageStatus(image.id)
          })
          
          card.querySelector('.delete-btn')?.addEventListener('click', (e) => {
            e.stopPropagation()
            this.deleteImage(image.id)
          })
          
          card.querySelector('.info-btn')?.addEventListener('click', (e) => {
            e.stopPropagation()
            this.showImageDetails(image.id)
          })
          
          gallery.appendChild(card)
        })
      } else {
        gallery.innerHTML = '<div class="pinterest-empty-state"><p class="text-gray-500 text-center py-8">Chưa có ảnh nào được upload</p></div>'
      }
      
    } catch (error) {
      console.error('Error loading image gallery:', error)
    }
  }

  // Generate Pinterest-style random heights
  getPinterestHeight(index) {
    const heights = [180, 220, 260, 200, 240, 300, 160, 280]
    return heights[index % heights.length]
  }

  // Pinterest-style pin functionality
  pinImage(imageId, cardElement) {
    console.log('Pin image:', imageId)
    
    // Toggle pin state
    cardElement.classList.toggle('selected')
    const pinBtn = cardElement.querySelector('.pinterest-pin-btn')
    
    if (cardElement.classList.contains('selected')) {
      pinBtn.innerHTML = '<i class="fas fa-check mr-1"></i>Pinned'
      pinBtn.style.background = '#6366f1'
      pinBtn.style.color = 'white'
    } else {
      pinBtn.innerHTML = '<i class="fas fa-thumbtack mr-1"></i>Pin'
      pinBtn.style.background = 'rgba(255, 255, 255, 0.9)'
      pinBtn.style.color = '#374151'
    }
  }

  // Pinterest-style image management methods
  showImageDetails(imageId) {
    console.log('Show details for image:', imageId)
    // TODO: Implement image details modal with Pinterest-style design
    alert(`Xem chi tiết ảnh ID: ${imageId}\n\nTính năng này sẽ hiển thị:\n• Thông tin ảnh chi tiết\n• Lịch sử sử dụng trong khảo sát\n• Thống kê lựa chọn`)
  }

  editImage(imageId) {
    console.log('Edit image:', imageId)
    // TODO: Implement edit modal
    alert(`Chỉnh sửa ảnh ID: ${imageId}`)
  }

  async toggleImageStatus(imageId) {
    try {
      const response = await fetch(`/api/admin/images/${imageId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        await this.loadImageGallery() // Refresh gallery
        console.log('Image status toggled successfully')
      }
    } catch (error) {
      console.error('Error toggling image status:', error)
    }
  }

  async deleteImage(imageId) {
    if (confirm('Bạn có chắc muốn xóa ảnh này?')) {
      try {
        const response = await fetch(`/api/admin/images/${imageId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (response.ok) {
          await this.loadImageGallery() // Refresh gallery
          console.log('Image deleted successfully')
        }
      } catch (error) {
        console.error('Error deleting image:', error)
      }
    }
  }

  displayStyleChart(styleData) {
    const chartDiv = document.getElementById('style-chart')
    chartDiv.innerHTML = ''
    
    const maxCount = Math.max(...styleData.map(s => s.total_chosen))
    
    styleData.forEach(style => {
      const percentage = maxCount > 0 ? (style.total_chosen / maxCount) * 100 : 0
      
      const div = document.createElement('div')
      div.className = 'flex items-center space-x-4'
      div.innerHTML = `
        <div class="w-24 text-sm font-medium capitalize text-gray-700">${style.style}</div>
        <div class="flex-1 bg-gray-200 rounded-full h-3">
          <div class="bg-indigo-600 h-3 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
        </div>
        <div class="text-sm text-gray-600 w-16">${style.total_chosen} lượt</div>
      `
      chartDiv.appendChild(div)
    })
  }

  async handleImageUpload(files) {
    if (!files || files.length === 0) {
      this.showError('Vui lòng chọn ít nhất một ảnh')
      return
    }
    
    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('image', file)
        
        const response = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData
        })
        
        const result = await response.json()
        
        if (result.success) {
          console.log(`Uploaded ${file.name} as ${result.style} style`)
        } else {
          console.error(`Failed to upload ${file.name}:`, result.error)
        }
      }
      
      // Refresh gallery and stats
      await this.loadImageGallery()
      await this.loadAdminStats()
      
      // Reset form
      document.getElementById('image-input').value = ''
      
      alert('Upload thành công!')
      
    } catch (error) {
      console.error('Error uploading images:', error)
      this.showError('Có lỗi xảy ra khi upload ảnh')
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ArchitectureSurvey()
})