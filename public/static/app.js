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
    console.log('🖼️ displayImagePair called:', { leftImage, rightImage })
    
    const leftImg = document.getElementById('left-image')
    const rightImg = document.getElementById('right-image')
    
    console.log('🎯 Image elements:', { leftImg, rightImg })
    
    // Sử dụng API endpoint để lấy ảnh thực tế hoặc SVG fallback
    const leftSrc = `/api/images/${leftImage.id}`
    const rightSrc = `/api/images/${rightImage.id}`
    
    console.log('🔗 Image sources:', { leftSrc, rightSrc })
    
    // Add error handlers
    leftImg.onerror = () => {
      console.error('❌ Left image failed to load:', leftSrc)
    }
    
    rightImg.onerror = () => {
      console.error('❌ Right image failed to load:', rightSrc)
    }
    
    leftImg.onload = () => {
      console.log('✅ Left image loaded successfully:', leftSrc)
    }
    
    rightImg.onload = () => {
      console.log('✅ Right image loaded successfully:', rightSrc)
    }
    
    leftImg.src = leftSrc
    rightImg.src = rightSrc
    
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
        data.images.forEach(image => {
          const div = document.createElement('div')
          div.className = 'relative group rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow'
          div.innerHTML = `
            <img src="/api/images/${image.id}" 
                 alt="${image.style}" 
                 class="w-full h-32 object-cover"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
            <div class="w-full h-32 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg" style="display:none;">
              ${image.style.toUpperCase()}
            </div>
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-end p-2">
              <div class="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                <p class="font-medium capitalize">${image.style}</p>
                <p class="text-xs opacity-75">${image.filename}</p>
              </div>
            </div>
          `
          gallery.appendChild(div)
        })
      } else {
        gallery.innerHTML = '<p class="text-gray-500 col-span-full text-center py-8">Chưa có ảnh nào được upload</p>'
      }
      
    } catch (error) {
      console.error('Error loading image gallery:', error)
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