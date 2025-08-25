// Architecture Survey App - Frontend Logic

class ArchitectureSurvey {
  constructor() {
    this.sessionId = null
    this.currentPair = null
    this.startTime = null
    this.totalPairs = 0
    this.maxPairs = 10
    this.surveyCategory = 'architecture' // Default category
    
    this.init()
  }

  selectSurveyType(category) {
    this.surveyCategory = category
    
    // Update UI based on category
    const typeIcon = document.getElementById('survey-type-icon')
    const typeTitle = document.getElementById('survey-type-title')
    const typeDescription = document.getElementById('survey-type-description')
    
    if (category === 'architecture') {
      typeIcon.innerHTML = '<i class="fas fa-building text-blue-600 text-2xl"></i>'
      typeIcon.className = 'w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto'
      typeTitle.textContent = 'Khảo Sát Kiến Trúc'
      typeDescription.textContent = 'Chọn 1 trong 2 hình ảnh kiến trúc mà bạn thích hơn, hoặc bỏ qua nếu không có ảnh nào phù hợp. Sau 10 lượt chọn, chúng tôi sẽ phân tích phong cách kiến trúc của bạn.'
    } else if (category === 'interior') {
      typeIcon.innerHTML = '<i class="fas fa-couch text-emerald-600 text-2xl"></i>'
      typeIcon.className = 'w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto'
      typeTitle.textContent = 'Khảo Sát Nội Thất'
      typeDescription.textContent = 'Chọn 1 trong 2 hình ảnh nội thất mà bạn thích hơn, hoặc bỏ qua nếu không có ảnh nào phù hợp. Sau 10 lượt chọn, chúng tôi sẽ phân tích phong cách nội thất của bạn.'
    }
    
    this.showScreen('survey-type-screen')
  }

  backToSelection() {
    this.showScreen('welcome-screen')
  }

  init() {
    // Initialize user demographics
    this.userDemographics = {}
    
    // Bind event listeners
    document.getElementById('start-architecture-survey')?.addEventListener('click', () => this.selectSurveyType('architecture'))
    document.getElementById('start-interior-survey')?.addEventListener('click', () => this.selectSurveyType('interior'))
    document.getElementById('show-demographics-form')?.addEventListener('click', () => this.showDemographicsForm())
    document.getElementById('back-to-selection')?.addEventListener('click', () => this.backToSelection())
    document.getElementById('left-choice')?.addEventListener('click', () => this.makeChoice('left'))
    document.getElementById('right-choice')?.addEventListener('click', () => this.makeChoice('right'))
    document.getElementById('skip-choice')?.addEventListener('click', () => this.makeChoice('skip'))
    document.getElementById('restart-survey')?.addEventListener('click', () => this.restartSurvey())
    
    // Demographics form handlers
    document.getElementById('demographics-form')?.addEventListener('submit', (e) => this.handleDemographicsSubmit(e))
    document.getElementById('skip-demographics')?.addEventListener('click', () => this.skipDemographics())
    
    // Check if we're on admin page or admin mode parameter
    const urlParams = new URLSearchParams(window.location.search)
    if (window.location.pathname === '/secure-admin-panel-2024' || 
        window.location.pathname === '/admin' || 
        urlParams.get('mode') === 'admin') {
      this.initAdmin()
    }
  }

  showDemographicsForm() {
    this.showScreen('demographics-screen')
  }

  async handleDemographicsSubmit(e) {
    e.preventDefault()
    
    // Collect demographics data
    this.userDemographics = {
      user_name: document.getElementById('user_name')?.value?.trim() || null,
      user_email: document.getElementById('user_email')?.value?.trim() || null,
      user_phone: document.getElementById('user_phone')?.value?.trim() || null,
      user_location: document.getElementById('user_location')?.value || null,
      user_age_range: document.getElementById('user_age_range')?.value || null,
      user_gender: document.getElementById('user_gender')?.value || null
    }
    
    await this.startSurvey()
  }

  skipDemographics() {
    this.userDemographics = {}
    this.startSurvey()
  }

  async startSurvey() {
    try {
      // Create new session with category and demographics
      const requestData = {
        category: this.surveyCategory,
        ...this.userDemographics
      }
      
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
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
    const isSkipped = side === 'skip'
    const chosenImageId = isSkipped ? null : (side === 'left' ? this.currentPair.leftImage.id : this.currentPair.rightImage.id)
    
    try {
      const response = await fetch(`/api/sessions/${this.sessionId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leftImageId: this.currentPair.leftImage.id,
          rightImageId: this.currentPair.rightImage.id,
          chosenImageId: chosenImageId,
          responseTime: responseTime,
          isSkipped: isSkipped
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
    const screens = ['welcome-screen', 'survey-type-screen', 'survey-screen', 'result-screen']
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
    // Show admin screen first
    this.showScreen('admin-screen')
    
    this.currentAdminCategory = 'architecture' // Default admin category
    this.currentDemographicsCategory = 'all' // Default demographics filter
    
    await this.loadAdminStats()
    await this.loadImageGallery()
    await this.loadDemographicsAnalytics()
    this.initDuplicateManagement()
    this.initImageFilter() // Add image filter functionality
    this.initCategoryTabs() // Initialize category tabs
    this.initDemographicsFilters() // Initialize demographics filters
    this.initBulkActions() // Initialize bulk actions
    this.initUserProfiles() // Initialize user profiles section
    
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

  // Initialize demographics filter buttons
  initDemographicsFilters() {
    document.getElementById('demographics-architecture-btn')?.addEventListener('click', () => this.filterDemographics('architecture'))
    document.getElementById('demographics-interior-btn')?.addEventListener('click', () => this.filterDemographics('interior'))
    document.getElementById('demographics-all-btn')?.addEventListener('click', () => this.filterDemographics('all'))
  }

  async filterDemographics(category) {
    this.currentDemographicsCategory = category
    
    // Update button styles
    document.querySelectorAll('.demographics-filter-btn').forEach(btn => {
      btn.classList.remove('bg-blue-600', 'bg-emerald-600', 'bg-gray-600')
      btn.classList.add('bg-gray-400')
    })
    
    if (category === 'architecture') {
      document.getElementById('demographics-architecture-btn').classList.remove('bg-gray-400')
      document.getElementById('demographics-architecture-btn').classList.add('bg-blue-600')
    } else if (category === 'interior') {
      document.getElementById('demographics-interior-btn').classList.remove('bg-gray-400')
      document.getElementById('demographics-interior-btn').classList.add('bg-emerald-600')
    } else {
      document.getElementById('demographics-all-btn').classList.remove('bg-gray-400')
      document.getElementById('demographics-all-btn').classList.add('bg-gray-600')
    }
    
    await this.loadDemographicsAnalytics()
  }

  // Initialize category tabs
  initCategoryTabs() {
    // Main category tabs (for demographics)
    const archTab = document.getElementById('tab-architecture')
    const interiorTab = document.getElementById('tab-interior')
    
    archTab?.addEventListener('click', () => this.switchAdminCategory('architecture'))
    interiorTab?.addEventListener('click', () => this.switchAdminCategory('interior'))
    
    // Gallery category tabs
    const galleryArchTab = document.getElementById('gallery-tab-architecture')
    const galleryInteriorTab = document.getElementById('gallery-tab-interior')
    
    galleryArchTab?.addEventListener('click', () => this.switchAdminCategory('architecture'))
    galleryInteriorTab?.addEventListener('click', () => this.switchAdminCategory('interior'))
  }

  // Switch admin category
  async switchAdminCategory(category) {
    console.log('Switching to category:', category, 'from:', this.currentAdminCategory)
    this.currentAdminCategory = category
    
    // Update all tab styles (both main and gallery tabs)
    const tabs = document.querySelectorAll('.category-tab')
    tabs.forEach(tab => {
      tab.classList.remove('border-blue-500', 'text-blue-600', 'border-indigo-500', 'text-indigo-600')
      tab.classList.add('border-transparent', 'text-gray-500')
    })
    
    // Update main tabs (blue style)
    const activeMainTab = document.getElementById(`tab-${category}`)
    if (activeMainTab) {
      activeMainTab.classList.remove('border-transparent', 'text-gray-500')
      activeMainTab.classList.add('border-blue-500', 'text-blue-600')
    }
    
    // Update gallery tabs (indigo style)
    const activeGalleryTab = document.getElementById(`gallery-tab-${category}`)
    if (activeGalleryTab) {
      activeGalleryTab.classList.remove('border-transparent', 'text-gray-500')
      activeGalleryTab.classList.add('border-indigo-500', 'text-indigo-600')
    }
    
    // Update upload section
    const uploadCategoryField = document.getElementById('upload-category')
    const uploadCategoryLabel = document.getElementById('upload-category-label')
    const uploadHint = document.getElementById('upload-hint')
    
    if (uploadCategoryField) uploadCategoryField.value = category
    if (uploadCategoryLabel) {
      uploadCategoryLabel.textContent = category === 'architecture' ? 'Kiến Trúc' : 'Nội Thất'
    }
    if (uploadHint) {
      uploadHint.textContent = category === 'architecture' 
        ? 'Tên file sẽ quyết định phong cách kiến trúc (vd: modern_house_01.jpg)'
        : 'Tên file sẽ quyết định phong cách nội thất (vd: minimalist_living_room_01.jpg)'
    }
    
    // Update style filter options
    const architectureStyles = document.getElementById('architecture-styles')
    const interiorStyles = document.getElementById('interior-styles')
    
    if (category === 'architecture') {
      if (architectureStyles) architectureStyles.style.display = ''
      if (interiorStyles) interiorStyles.style.display = 'none'
    } else {
      if (architectureStyles) architectureStyles.style.display = 'none'
      if (interiorStyles) interiorStyles.style.display = ''
    }
    
    // Update style popularity chart based on current category
    this.updateStyleChartByCategory(category)
    
    // Update category management labels
    this.updateCategoryLabels(category)
    
    // Reset filters and reload gallery
    document.getElementById('search-input').value = ''
    document.getElementById('style-filter').value = 'all'
    document.getElementById('status-filter').value = 'all'
    
    await this.loadImageGallery()
    await this.refreshStyleFilterOptions()
  }

  // Update style chart based on category
  updateStyleChartByCategory(category) {
    if (!this.adminStatsData || !this.adminStatsData.stylePopularityByCategory) return
    
    // Filter style data by category
    const categoryStyleData = this.adminStatsData.stylePopularityByCategory.filter(
      style => style.category === category
    )
    
    if (categoryStyleData.length > 0) {
      // Update popular style text
      document.getElementById('popular-style').textContent = categoryStyleData[0].style || '-'
      
      // Update chart with category-specific data
      this.displayStyleChart(categoryStyleData)
    } else {
      // No data for this category
      document.getElementById('popular-style').textContent = '-'
      const chartDiv = document.getElementById('style-chart')
      if (chartDiv) {
        chartDiv.innerHTML = `<p class="text-gray-500 text-center py-4">Chưa có dữ liệu phong cách cho ${category === 'architecture' ? 'kiến trúc' : 'nội thất'}</p>`
      }
    }
  }

  // Initialize duplicate management
  initDuplicateManagement() {
    // Filename-based duplicate detection
    const scanBtn = document.getElementById('scan-duplicates-btn')
    const cleanBtn = document.getElementById('clean-duplicates-btn')
    
    scanBtn?.addEventListener('click', () => this.scanDuplicates())
    cleanBtn?.addEventListener('click', () => this.cleanDuplicates())
    
    // Content-based duplicate detection
    const scanContentBtn = document.getElementById('scan-content-duplicates-btn')
    const cleanContentBtn = document.getElementById('clean-content-duplicates-btn')
    
    scanContentBtn?.addEventListener('click', () => this.scanContentDuplicates())
    cleanContentBtn?.addEventListener('click', () => this.cleanContentDuplicates())
  }

  // Initialize image filter functionality
  initImageFilter() {
    const searchBtn = document.getElementById('search-btn')
    const searchInput = document.getElementById('search-input')
    const styleFilter = document.getElementById('style-filter')
    const statusFilter = document.getElementById('status-filter')
    
    // Search button click
    searchBtn?.addEventListener('click', () => this.performImageSearch())
    
    // Enter key in search input
    searchInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.performImageSearch()
      }
    })
    
    // Filter change events
    styleFilter?.addEventListener('change', () => this.performImageSearch())
    statusFilter?.addEventListener('change', () => this.performImageSearch())
  }

  // Scan for duplicate images
  async scanDuplicates() {
    const scanBtn = document.getElementById('scan-duplicates-btn')
    const container = document.getElementById('duplicates-container')
    const summary = document.getElementById('duplicates-summary')
    
    try {
      scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Đang quét...'
      scanBtn.disabled = true
      
      const response = await fetch('/api/admin/duplicates')
      const data = await response.json()
      
      if (data.duplicates && data.duplicates.length > 0) {
        // Show summary
        document.getElementById('duplicate-groups-count').textContent = data.total_groups
        document.getElementById('total-duplicates-count').textContent = data.total_duplicates
        summary.classList.remove('hidden')
        
        // Display duplicates
        container.innerHTML = data.duplicates.map(group => `
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h3 class="font-semibold text-red-800">${group.filename}</h3>
                <p class="text-sm text-red-600">Style: ${group.style} • ${group.count} bản copy</p>
              </div>
              <span class="bg-red-100 text-red-800 px-2 py-1 rounded text-sm font-medium">
                ${group.count - 1} thừa
              </span>
            </div>
            <div class="text-xs text-gray-600">
              <p>IDs: ${group.ids.join(', ')}</p>
              <p>Từ: ${group.first_upload} đến: ${group.last_upload}</p>
            </div>
          </div>
        `).join('')
      } else {
        container.innerHTML = `
          <div class="text-center text-green-600 py-8">
            <i class="fas fa-check-circle text-4xl mb-4 block"></i>
            <p class="font-medium">Không tìm thấy ảnh trùng lặp!</p>
          </div>
        `
        summary.classList.add('hidden')
      }
      
    } catch (error) {
      console.error('Error scanning duplicates:', error)
      container.innerHTML = `
        <div class="text-center text-red-600 py-8">
          <i class="fas fa-exclamation-triangle text-4xl mb-4 block"></i>
          <p>Lỗi khi quét ảnh trùng lặp</p>
        </div>
      `
    } finally {
      scanBtn.innerHTML = '<i class="fas fa-search mr-1"></i> Quét Trùng Lặp'
      scanBtn.disabled = false
    }
  }

  // Clean all duplicates (keep oldest)
  async cleanDuplicates() {
    if (!confirm('Bạn có chắc muốn xóa TẤT CẢ ảnh trùng lặp? Hành động này không thể hoàn tác!')) {
      return
    }
    
    const cleanBtn = document.getElementById('clean-duplicates-btn')
    const container = document.getElementById('duplicates-container')
    
    try {
      cleanBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Đang dọn dẹp...'
      cleanBtn.disabled = true
      
      const response = await fetch('/api/admin/clean-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      
      if (data.success) {
        container.innerHTML = `
          <div class="text-center text-green-600 py-8">
            <i class="fas fa-check-circle text-4xl mb-4 block"></i>
            <p class="font-medium">Đã xóa ${data.deleted_count} ảnh trùng lặp!</p>
            <p class="text-sm text-gray-600 mt-2">Dọn dẹp ${data.groups_cleaned} nhóm ảnh</p>
          </div>
        `
        document.getElementById('duplicates-summary').classList.add('hidden')
        
        // Refresh image gallery and stats
        await this.loadAdminStats()
        await this.loadImageGallery()
      } else {
        throw new Error(data.error || 'Unknown error')
      }
      
    } catch (error) {
      console.error('Error cleaning duplicates:', error)
      container.innerHTML = `
        <div class="text-center text-red-600 py-8">
          <i class="fas fa-exclamation-triangle text-4xl mb-4 block"></i>
          <p>Lỗi khi dọn dẹp ảnh trùng lặp</p>
        </div>
      `
    } finally {
      cleanBtn.innerHTML = '<i class="fas fa-trash mr-1"></i> Dọn Dẹp Tất Cả'
      cleanBtn.disabled = false
    }
  }

  // Perform image search/filter
  async performImageSearch() {
    const searchInput = document.getElementById('search-input')
    const styleFilter = document.getElementById('style-filter')
    const statusFilter = document.getElementById('status-filter')
    const searchBtn = document.getElementById('search-btn')
    
    try {
      // Show loading state
      searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Đang lọc...'
      searchBtn.disabled = true
      
      // Get filter values
      const searchTerm = searchInput?.value.trim() || ''
      const selectedStyle = styleFilter?.value || 'all'
      const selectedStatus = statusFilter?.value || 'all'
      
      // Build query parameters
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (selectedStyle !== 'all') params.append('style', selectedStyle)
      if (selectedStatus !== 'all') params.append('status', selectedStatus)
      
      // Include current category filter
      const category = this.currentAdminCategory || 'architecture'
      params.append('category', category)
      params.append('limit', '100') // Show more results when filtering
      
      // Call search API
      const response = await fetch(`/api/admin/images/search?${params.toString()}`)
      const data = await response.json()
      
      if (data.images) {
        // Update gallery with filtered results
        this.updateImageGallery(data.images)
        console.log(`Filtered: ${data.images.length} images found (total: ${data.total})`)
      } else {
        console.error('Search failed:', data.error)
        alert('Có lỗi khi lọc ảnh: ' + (data.error || 'Unknown error'))
      }
      
    } catch (error) {
      console.error('Error performing search:', error)
      alert('Có lỗi xảy ra khi lọc ảnh')
    } finally {
      // Reset button state
      searchBtn.innerHTML = '<i class="fas fa-search mr-2"></i>Lọc'
      searchBtn.disabled = false
    }
  }

  async loadAdminStats() {
    try {
      const response = await fetch('/api/admin/stats')
      const data = await response.json()
      
      // Overall stats
      document.getElementById('total-sessions').textContent = data.totalCompletedSessions || 0
      document.getElementById('total-images').textContent = data.totalActiveImages || 0
      
      // Category breakdown for sessions
      if (data.sessionsByCategory && data.sessionsByCategory.length > 0) {
        const breakdown = data.sessionsByCategory.map(cat => 
          `${cat.category === 'architecture' ? '🏗️' : '🛋️'} ${cat.completed_sessions}`
        ).join(' • ')
        document.getElementById('sessions-breakdown').innerHTML = breakdown
      }
      
      // Category breakdown for images
      if (data.imagesByCategory && data.imagesByCategory.length > 0) {
        const breakdown = data.imagesByCategory.map(cat => 
          `${cat.category === 'architecture' ? '🏗️' : '🛋️'} ${cat.active_images}`
        ).join(' • ')
        document.getElementById('images-breakdown').innerHTML = breakdown
      }
      
      // Contact stats
      if (data.demographicsStats) {
        const totalContacts = data.demographicsStats.reduce((sum, d) => 
          sum + (d.session_count || 0), 0
        )
        document.getElementById('total-contacts').textContent = totalContacts
      }
      
      if (data.stylePopularity && data.stylePopularity.length > 0) {
        document.getElementById('popular-style').textContent = data.stylePopularity[0].style || '-'
        this.displayStyleChart(data.stylePopularityByCategory || data.stylePopularity)
      }
      
      // Store full stats data for category filtering
      this.adminStatsData = data
      
    } catch (error) {
      console.error('Error loading admin stats:', error)
    }
  }

  async loadDemographicsAnalytics() {
    try {
      const category = this.currentDemographicsCategory || 'all'
      const response = await fetch(`/api/admin/demographics?category=${category}`)
      const data = await response.json()
      
      this.displayDemographicsChart(data.demographics || [])
      this.displayLocationChart(data.demographics || [])
      
    } catch (error) {
      console.error('Error loading demographics analytics:', error)
    }
  }

  displayDemographicsChart(demographics) {
    const chartDiv = document.getElementById('demographics-chart')
    if (!chartDiv) return
    
    chartDiv.innerHTML = ''
    
    console.log('Displaying demographics chart for:', demographics.length, 'items')
    
    // Group by age range
    const ageGroups = {}
    demographics.forEach(demo => {
      if (demo.user_age_range) {
        if (!ageGroups[demo.user_age_range]) {
          ageGroups[demo.user_age_range] = { male: 0, female: 0, other: 0 }
        }
        const gender = demo.user_gender || 'other'
        ageGroups[demo.user_age_range][gender] = (ageGroups[demo.user_age_range][gender] || 0) + demo.session_count
      }
    })
    
    console.log('Age groups:', ageGroups)
    
    if (Object.keys(ageGroups).length === 0) {
      const categoryName = this.currentDemographicsCategory === 'architecture' ? 'kiến trúc' : 
                          this.currentDemographicsCategory === 'interior' ? 'nội thất' : ''
      chartDiv.innerHTML = `<p class="text-gray-500 text-center py-4">Chưa có dữ liệu nhân khẩu học${categoryName ? ' cho ' + categoryName : ''}</p>`
      return
    }
    
    Object.entries(ageGroups).forEach(([ageRange, genders]) => {
      const total = genders.male + genders.female + genders.other
      
      const div = document.createElement('div')
      div.className = 'bg-gray-50 rounded-lg p-3'
      div.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <span class="font-medium text-gray-700">${ageRange}</span>
          <span class="text-sm text-gray-600">${total} người</span>
        </div>
        <div class="flex space-x-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div class="bg-blue-500" style="width: ${total > 0 ? (genders.male/total)*100 : 0}%"></div>
          <div class="bg-pink-500" style="width: ${total > 0 ? (genders.female/total)*100 : 0}%"></div>
          <div class="bg-gray-500" style="width: ${total > 0 ? (genders.other/total)*100 : 0}%"></div>
        </div>
        <div class="flex justify-between text-xs text-gray-500 mt-1">
          <span>👨 ${genders.male}</span>
          <span>👩 ${genders.female}</span>
          <span>👤 ${genders.other}</span>
        </div>
      `
      chartDiv.appendChild(div)
    })
  }

  displayLocationChart(demographics) {
    const chartDiv = document.getElementById('location-chart')
    if (!chartDiv) return
    
    chartDiv.innerHTML = ''
    
    console.log('Displaying location chart for:', demographics.length, 'items')
    
    // Group by location
    const locationGroups = {}
    demographics.forEach(demo => {
      if (demo.user_location) {
        locationGroups[demo.user_location] = (locationGroups[demo.user_location] || 0) + demo.session_count
      }
    })
    
    console.log('Location groups:', locationGroups)
    
    if (Object.keys(locationGroups).length === 0) {
      const categoryName = this.currentDemographicsCategory === 'architecture' ? 'kiến trúc' : 
                          this.currentDemographicsCategory === 'interior' ? 'nội thất' : ''
      chartDiv.innerHTML = `<p class="text-gray-500 text-center py-4">Chưa có dữ liệu địa lý${categoryName ? ' cho ' + categoryName : ''}</p>`
      return
    }
    
    const sortedLocations = Object.entries(locationGroups).sort((a, b) => b[1] - a[1])
    const maxCount = Math.max(...Object.values(locationGroups))
    
    sortedLocations.forEach(([location, count]) => {
      const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0
      
      const div = document.createElement('div')
      div.className = 'flex items-center space-x-3'
      div.innerHTML = `
        <div class="w-20 text-sm font-medium text-gray-700 truncate">${location}</div>
        <div class="flex-1 bg-gray-200 rounded-full h-3">
          <div class="bg-emerald-600 h-3 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
        </div>
        <div class="text-sm text-gray-600 w-8">${count}</div>
      `
      chartDiv.appendChild(div)
    })
  }

  async loadImageGallery() {
    try {
      // Show loading state
      const gallery = document.getElementById('image-gallery')
      if (gallery) {
        gallery.innerHTML = '<div class="col-span-4 text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i><p class="text-gray-500 mt-2">Đang tải ảnh...</p></div>'
      }
      
      // Include category filter for admin
      const category = this.currentAdminCategory || 'architecture'
      console.log('Loading gallery for category:', category, 'currentAdminCategory:', this.currentAdminCategory)
      
      // Add timestamp to prevent caching
      const timestamp = Date.now()
      const response = await fetch(`/api/admin/images?category=${category}&t=${timestamp}`)
      const data = await response.json()
      
      console.log('Received images:', data.images?.length, 'for category:', data.category)
      
      if (data.images) {
        this.updateImageGallery(data.images)
      }
    } catch (error) {
      console.error('Error loading image gallery:', error)
      const gallery = document.getElementById('image-gallery')
      if (gallery) {
        gallery.innerHTML = '<div class="col-span-4 text-center py-8 text-red-500"><i class="fas fa-exclamation-triangle text-2xl"></i><p class="mt-2">Lỗi khi tải ảnh</p></div>'
      }
    }
  }

  // Update gallery display with given images
  updateImageGallery(images) {
    const gallery = document.getElementById('image-gallery')
    gallery.innerHTML = ''
    
    // Update category image count
    const categoryImageCount = document.getElementById('category-image-count')
    if (categoryImageCount) {
      const count = images ? images.length : 0
      categoryImageCount.textContent = `${count} ảnh`
    }
    
    // Sort images alphabetically by filename
    if (images && images.length > 0) {
      images.sort((a, b) => a.filename.localeCompare(b.filename))
    }
      
    if (images && images.length > 0) {
      images.forEach((image, index) => {
          // Create grid card
          const card = document.createElement('div')
          
          card.className = `grid-card`
          card.dataset.imageId = image.id
          
          card.innerHTML = `
            <div class="relative h-full">
              <img src="/api/images/${image.id}" 
                   alt="${image.style}" 
                   class="grid-card-image"
                   onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"
                   onload="this.classList.add('loaded')">
              
              <div class="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 flex flex-col items-center justify-center text-white font-bold text-lg" 
                   style="display:none">
                <i class="fas fa-building mb-2 text-2xl"></i>
                <span class="text-center text-sm">${image.style.toUpperCase()}</span>
              </div>
              
              <div class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-50 transition-all duration-300 flex flex-col justify-between p-3 opacity-0 hover:opacity-100">
                <div class="flex justify-between items-start">
                  <div class="bg-white bg-opacity-90 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-medium text-gray-800">
                    ID: ${image.id}
                  </div>
                  <div class="bg-${image.is_active ? 'green' : 'red'}-500 text-white px-2 py-1 rounded-lg text-xs font-medium">
                    ${image.is_active ? '✓ Active' : '⏸ Inactive'}
                  </div>
                </div>
                
                <div class="space-y-2">
                  <div class="bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-2">
                    <div class="text-sm font-semibold text-gray-800 uppercase">${image.style}</div>
                    <div class="text-xs text-gray-600 truncate">${image.filename}</div>
                  </div>
                  
                  <div class="grid grid-cols-2 gap-1">
                    <button class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs edit-btn" data-id="${image.id}" title="Edit Info">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button class="bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded text-xs edit-filename-btn" data-id="${image.id}" title="Edit Filename">
                      <i class="fas fa-file-signature"></i>
                    </button>
                    <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs toggle-btn" data-id="${image.id}" title="${image.is_active ? 'Deactivate' : 'Activate'}">
                      <i class="fas fa-${image.is_active ? 'eye-slash' : 'eye'}"></i>
                    </button>
                    <button class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs delete-btn" data-id="${image.id}" title="Delete">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                  <div class="flex mt-1">
                    <button class="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs info-btn" data-id="${image.id}" title="Info">
                      <i class="fas fa-info mr-1"></i>Info
                    </button>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          `
          
          // Add click handler for image details
          card.addEventListener('click', (e) => {
            // Only show details if not clicking on action buttons
            if (!e.target.closest('button')) {
              this.showImageDetails(image.id)
            }
          })
          
          // Add event listeners for action buttons
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
      gallery.innerHTML = '<div class="col-span-full text-center py-12"><i class="fas fa-images text-gray-300 text-6xl mb-4 block"></i><p class="text-gray-500">Không tìm thấy ảnh nào</p></div>'
    }
  }

  // Image management methods
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

  // Force admin mode for /admin route
  forceAdminMode() {
    this.currentScreen = 'admin'
    this.initAdmin().catch(error => {
      console.error('Failed to initialize admin:', error)
    })
  }

  async handleImageUpload(files) {
    if (!files || files.length === 0) {
      this.showError('Vui lòng chọn ít nhất một ảnh')
      return
    }
    
    try {
      const category = this.currentAdminCategory || 'architecture'
      
      for (const file of files) {
        const formData = new FormData()
        formData.append('image', file)
        formData.append('category', category) // Include category
        
        const response = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData
        })
        
        const result = await response.json()
        
        if (result.success) {
          console.log(`Uploaded ${file.name} as ${result.style} style for ${result.category}`)
        } else {
          console.error(`Failed to upload ${file.name}:`, result.error)
        }
      }
      
      // Refresh gallery, stats, and style filter dropdown
      await this.loadImageGallery()
      await this.loadAdminStats()
      await this.refreshStyleFilterOptions()
      
      // Reset form
      document.getElementById('image-input').value = ''
      
      alert('Upload thành công!')
      
    } catch (error) {
      console.error('Error uploading images:', error)
      this.showError('Có lỗi xảy ra khi upload ảnh')
    }
  }

  // Refresh style filter options based on uploaded images
  async refreshStyleFilterOptions() {
    try {
      // Get styles for both categories to build complete lists
      const [archResponse, interiorResponse] = await Promise.all([
        fetch('/api/admin/images/search?category=architecture&limit=1000'),
        fetch('/api/admin/images/search?category=interior&limit=1000')
      ])
      
      const [archData, interiorData] = await Promise.all([
        archResponse.json(),
        interiorResponse.json()
      ])
      
      // Extract and sort unique styles for architecture
      const archStyles = [...new Set(
        (archData.images || []).map(img => img.style.trim().toLowerCase())
      )].filter(style => style && style !== '').sort()
      
      // Extract and sort unique styles for interior  
      const interiorStyles = [...new Set(
        (interiorData.images || []).map(img => img.style.trim().toLowerCase())
      )].filter(style => style && style !== '').sort()
      
      // Update architecture optgroup
      this.updateStyleOptgroup('architecture-styles', archStyles, 'Kiến trúc')
      
      // Update interior optgroup
      this.updateStyleOptgroup('interior-styles', interiorStyles, 'Nội thất')
      
    } catch (error) {
      console.error('Error refreshing style filter options:', error)
    }
  }

  // Helper method to update style optgroup
  updateStyleOptgroup(optgroupId, styles, categoryName) {
    const optgroup = document.getElementById(optgroupId)
    if (!optgroup) return
    
    // Clear existing options
    optgroup.innerHTML = ''
    
    // Add sorted styles
    styles.forEach(style => {
      const option = document.createElement('option')
      option.value = style
      option.textContent = style.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
      optgroup.appendChild(option)
    })
    
    console.log(`Updated ${categoryName} styles: ${styles.length} options, sorted alphabetically`)
  }

  // Initialize bulk actions
  initBulkActions() {
    const deleteAllBtn = document.getElementById('delete-all')
    deleteAllBtn?.addEventListener('click', () => this.deleteAllImages())
    
    // Category management buttons
    const deleteCategoryBtn = document.getElementById('delete-category-all-btn')
    deleteCategoryBtn?.addEventListener('click', () => this.deleteCategoryImages())
    
    const refreshCategoryBtn = document.getElementById('refresh-category-btn')
    refreshCategoryBtn?.addEventListener('click', () => {
      this.loadImageGallery()
      this.loadAdminStats()
    })
    
    const debugCategoryBtn = document.getElementById('debug-category-btn')
    debugCategoryBtn?.addEventListener('click', () => this.debugCategoryState())
    
    // Add event delegation for image action buttons
    const imageGallery = document.getElementById('image-gallery')
    imageGallery?.addEventListener('click', (e) => {
      const imageId = e.target.closest('button')?.dataset.id
      if (!imageId) return
      
      if (e.target.closest('.edit-filename-btn')) {
        this.editImageFilename(imageId)
      } else if (e.target.closest('.edit-btn')) {
        this.editImageInfo(imageId)
      } else if (e.target.closest('.toggle-btn')) {
        this.toggleImageStatus(imageId)
      } else if (e.target.closest('.delete-btn')) {
        this.deleteImage(imageId)
      } else if (e.target.closest('.info-btn')) {
        this.showImageDetails(imageId)
      }
    })
  }

  // Delete all images with confirmation
  async deleteAllImages() {
    const confirmMessage = 'BẠN CÓ CHẮC CHẮN MUỐN XÓA TẤT CẢ ẢNH?\n\n' +
                          '⚠️ CẢNH BÁO: Hành động này sẽ:\n' +
                          '• Xóa toàn bộ thư viện ảnh\n' +
                          '• Xóa tất cả dữ liệu khảo sát liên quan\n' +
                          '• KHÔNG THỂ HOÀN TÁC!'
    
    const confirmation = confirm(confirmMessage)
    
    if (!confirmation) {
      return
    }

    const deleteBtn = document.getElementById('delete-all')
    
    try {
      deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Đang xóa...'
      deleteBtn.disabled = true
      
      const response = await fetch('/api/admin/images/all', {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert(`✅ ${data.message}`)
        
        // Refresh everything
        await this.loadAdminStats()
        await this.loadImageGallery()  
        await this.refreshStyleFilterOptions()
        
      } else {
        throw new Error(data.error || 'Unknown error')
      }
      
    } catch (error) {
      console.error('Error deleting all images:', error)
      alert('❌ Lỗi khi xóa tất cả ảnh: ' + error.message)
    } finally {
      deleteBtn.innerHTML = '<i class="fas fa-exclamation-triangle mr-1"></i> Xóa tất cả'
      deleteBtn.disabled = false
    }
  }

  // Edit image filename
  async editImageFilename(imageId) {
    try {
      // Get current image info
      const response = await fetch(`/api/admin/images/${imageId}`)
      const imageData = await response.json()
      
      if (imageData.error || !imageData.image) {
        throw new Error(imageData.error || 'Failed to get image info')
      }
      
      const image = imageData.image
      const currentFilename = image.original_name || image.filename
      
      // Get new filename from user
      const newFilename = prompt(
        `Sửa tên file ảnh:\n\nTên hiện tại: ${currentFilename}\n\nNhập tên mới (với extension):`,
        currentFilename
      )
      
      if (!newFilename || newFilename === currentFilename) {
        return // User cancelled or no change
      }
      
      // Validate filename
      if (!newFilename.match(/\.(jpg|jpeg|png|webp)$/i)) {
        alert('Tên file phải có extension (.jpg, .jpeg, .png, .webp)')
        return
      }
      
      // Update filename
      const updateResponse = await fetch(`/api/admin/images/${imageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: image.filename, // Keep technical filename
          style: image.style, // Keep current style  
          original_name: newFilename, // Update display name
          is_active: image.is_active
        })
      })
      
      const updateResult = await updateResponse.json()
      
      if (updateResult.success) {
        alert('✅ Đã cập nhật tên file thành công!')
        
        // Refresh gallery to show new filename
        await this.loadImageGallery()
        await this.refreshStyleFilterOptions()
        
      } else {
        throw new Error(updateResult.error || 'Failed to update filename')
      }
      
    } catch (error) {
      console.error('Error editing filename:', error)
      alert('❌ Lỗi khi sửa tên file: ' + error.message)
    }
  }

  // Placeholder methods for other button actions
  async editImageInfo(imageId) {
    console.log('Edit image info:', imageId)
    // TODO: Implement full edit modal
  }

  async toggleImageStatus(imageId) {
    try {
      const response = await fetch(`/api/admin/images/${imageId}/toggle`, {
        method: 'PATCH'
      })
      const result = await response.json()
      
      if (result.success) {
        await this.loadImageGallery()
        await this.loadAdminStats()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error toggling image status:', error)
      alert('Lỗi khi thay đổi trạng thái ảnh')
    }
  }

  async deleteImage(imageId) {
    if (!confirm('Bạn có chắc muốn xóa ảnh này?')) return
    
    try {
      const response = await fetch(`/api/admin/images/${imageId}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      
      if (result.success) {
        await this.loadImageGallery()
        await this.loadAdminStats()  
        await this.refreshStyleFilterOptions()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error deleting image:', error)
      alert('Lỗi khi xóa ảnh')
    }
  }

  async showImageDetails(imageId) {
    console.log('Show image details:', imageId)
    // TODO: Implement details modal
  }

  // Update category labels and info
  updateCategoryLabels(category) {
    const categoryLabel = document.getElementById('current-category-label')
    const deleteCategoryName = document.getElementById('delete-category-name')
    
    if (categoryLabel) {
      categoryLabel.textContent = category === 'architecture' ? 'Kiến Trúc' : 'Nội Thất'
    }
    
    if (deleteCategoryName) {
      deleteCategoryName.textContent = category === 'architecture' ? 'Kiến Trúc' : 'Nội Thất'
    }
  }
  
  // Debug category state
  debugCategoryState() {
    console.log('=== CATEGORY DEBUG INFO ===')
    console.log('Current admin category:', this.currentAdminCategory)
    
    // Check all tabs state
    const mainArchTab = document.getElementById('tab-architecture')
    const mainIntTab = document.getElementById('tab-interior')
    const galleryArchTab = document.getElementById('gallery-tab-architecture')
    const galleryIntTab = document.getElementById('gallery-tab-interior')
    
    console.log('Main tabs:')
    console.log('  Architecture active:', mainArchTab?.classList.contains('text-blue-600'))
    console.log('  Interior active:', mainIntTab?.classList.contains('text-blue-600'))
    
    console.log('Gallery tabs:')
    console.log('  Architecture active:', galleryArchTab?.classList.contains('text-indigo-600'))
    console.log('  Interior active:', galleryIntTab?.classList.contains('text-indigo-600'))
    
    // Check labels
    const categoryLabel = document.getElementById('current-category-label')
    const imageCount = document.getElementById('category-image-count')
    console.log('Category label:', categoryLabel?.textContent)
    console.log('Image count:', imageCount?.textContent)
    
    // Force reload gallery
    console.log('Force reloading gallery...')
    this.loadImageGallery()
    
    alert(`Debug info logged to console!\nCurrent category: ${this.currentAdminCategory}`)
  }

  // Delete all images in current category
  async deleteCategoryImages() {
    const category = this.currentAdminCategory || 'architecture'
    const categoryName = category === 'architecture' ? 'Kiến Trúc' : 'Nội Thất'
    
    const confirmMessage = `BẠN CÓ CHẮC CHẮN MUỐN XÓA TẤT CẢ ẢNH ${categoryName.toUpperCase()}?\n\n` +
                          `⚠️ CẢNH BÁO: Hành động này sẽ:\n` +
                          `• Xóa toàn bộ ảnh ${categoryName}\n` +
                          `• Xóa tất cả dữ liệu khảo sát liên quan\n` +
                          `• KHÔNG THỂ HOÀN TÁC!`
    
    const confirmation = confirm(confirmMessage)
    
    if (!confirmation) {
      return
    }

    const deleteBtn = document.getElementById('delete-category-all-btn')
    
    try {
      deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Đang xóa...'
      deleteBtn.disabled = true
      
      const response = await fetch(`/api/admin/images/category/${category}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert(`✅ ${data.message}`)
        
        // Refresh everything
        await this.loadAdminStats()
        await this.loadImageGallery()  
        await this.refreshStyleFilterOptions()
        
      } else {
        throw new Error(data.error || 'Unknown error')
      }
      
    } catch (error) {
      console.error('Error deleting category images:', error)
      alert(`❌ Lỗi khi xóa tất cả ảnh ${categoryName}: ` + error.message)
    } finally {
      deleteBtn.innerHTML = `<i class="fas fa-exclamation-triangle mr-1"></i> Xóa tất cả <span id="delete-category-name">${categoryName}</span>`
      deleteBtn.disabled = false
    }
  }

  // Initialize user profiles section
  initUserProfiles() {
    this.currentProfilesCategory = 'all'
    this.currentProfilesOffset = 0
    this.profilesLimit = 20
    
    // Load initial profiles
    this.loadUserProfiles()
    
    // Category filter buttons
    document.getElementById('profiles-architecture-btn')?.addEventListener('click', () => {
      this.switchProfilesCategory('architecture')
    })
    document.getElementById('profiles-interior-btn')?.addEventListener('click', () => {
      this.switchProfilesCategory('interior')
    })
    document.getElementById('profiles-all-btn')?.addEventListener('click', () => {
      this.switchProfilesCategory('all')
    })
    
    // Refresh button
    document.getElementById('refresh-profiles-btn')?.addEventListener('click', () => {
      this.loadUserProfiles()
    })
    
    // Pagination buttons
    document.getElementById('profiles-prev-btn')?.addEventListener('click', () => {
      if (this.currentProfilesOffset > 0) {
        this.currentProfilesOffset -= this.profilesLimit
        this.loadUserProfiles()
      }
    })
    document.getElementById('profiles-next-btn')?.addEventListener('click', () => {
      this.currentProfilesOffset += this.profilesLimit
      this.loadUserProfiles()
    })
  }

  // Switch profiles category
  async switchProfilesCategory(category) {
    this.currentProfilesCategory = category
    this.currentProfilesOffset = 0
    
    // Update button styles
    document.querySelectorAll('.profiles-filter-btn').forEach(btn => {
      btn.classList.remove('bg-blue-600', 'bg-emerald-600', 'bg-gray-600')
      btn.classList.add('bg-gray-400')
    })
    
    const activeBtn = document.getElementById(`profiles-${category}-btn`)
    if (activeBtn) {
      activeBtn.classList.remove('bg-gray-400')
      if (category === 'architecture') {
        activeBtn.classList.add('bg-blue-600')
      } else if (category === 'interior') {
        activeBtn.classList.add('bg-emerald-600') 
      } else {
        activeBtn.classList.add('bg-gray-600')
      }
    }
    
    await this.loadUserProfiles()
  }

  // Load user profiles
  async loadUserProfiles() {
    try {
      const response = await fetch(`/api/admin/user-profiles?category=${this.currentProfilesCategory}&limit=${this.profilesLimit}&offset=${this.currentProfilesOffset}`)
      const data = await response.json()
      
      this.displayUserProfiles(data.profiles || [])
      this.updateProfilesPagination(data.total || 0)
      
    } catch (error) {
      console.error('Error loading user profiles:', error)
      document.getElementById('user-profiles-container').innerHTML = `
        <div class="text-center py-8 text-red-500">
          <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
          <p>Lỗi khi tải hồ sơ người dùng</p>
        </div>
      `
    }
  }

  // Display user profiles
  displayUserProfiles(profiles) {
    const container = document.getElementById('user-profiles-container')
    
    if (!profiles || profiles.length === 0) {
      const categoryName = this.currentProfilesCategory === 'architecture' ? ' kiến trúc' : 
                          this.currentProfilesCategory === 'interior' ? ' nội thất' : ''
      container.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <i class="fas fa-user-friends text-3xl mb-4"></i>
          <p class="text-lg font-medium">Chưa có hồ sơ người khảo sát${categoryName}</p>
          <p class="text-sm mt-2">Các hồ sơ sẽ xuất hiện sau khi người dùng hoàn thành khảo sát</p>
        </div>
      `
      return
    }
    
    container.innerHTML = profiles.map(profile => {
      const completedDate = profile.completed_at ? 
        new Date(profile.completed_at).toLocaleDateString('vi-VN') : 
        'Chưa hoàn thành'
      
      const startedDate = new Date(profile.started_at).toLocaleDateString('vi-VN')
      
      const categoryIcon = profile.survey_category === 'architecture' ? 
        '<i class="fas fa-building text-blue-600"></i>' : 
        '<i class="fas fa-couch text-emerald-600"></i>'
      
      const statusBadge = profile.status === 'completed' ? 
        '<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">Hoàn thành</span>' :
        '<span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">Đang thực hiện</span>'
      
      return `
        <div class="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center space-x-3 mb-2">
                ${categoryIcon}
                <h3 class="font-semibold text-gray-800">
                  ${profile.user_name || 'Ẩn danh'}
                </h3>
                ${statusBadge}
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                <div>
                  <div class="flex items-center space-x-2 mb-1">
                    <i class="fas fa-envelope w-4"></i>
                    <span>${profile.user_email || 'Không cung cấp'}</span>
                  </div>
                  <div class="flex items-center space-x-2 mb-1">
                    <i class="fas fa-phone w-4"></i>
                    <span>${profile.user_phone || 'Không cung cấp'}</span>
                  </div>
                  <div class="flex items-center space-x-2 mb-1">
                    <i class="fas fa-map-marker-alt w-4"></i>
                    <span>${profile.user_location || 'Không cung cấp'}</span>
                  </div>
                </div>
                
                <div>
                  <div class="flex items-center space-x-2 mb-1">
                    <i class="fas fa-birthday-cake w-4"></i>
                    <span>${profile.user_age_range || 'Không cung cấp'}</span>
                  </div>
                  <div class="flex items-center space-x-2 mb-1">
                    <i class="fas fa-venus-mars w-4"></i>
                    <span>${profile.user_gender || 'Không cung cấp'}</span>
                  </div>
                  <div class="flex items-center space-x-2 mb-1">
                    <i class="fas fa-calendar w-4"></i>
                    <span>Bắt đầu: ${startedDate}</span>
                  </div>
                </div>
              </div>
              
              ${profile.result_style ? `
                <div class="mt-3 p-2 bg-indigo-50 rounded-lg">
                  <div class="flex items-center justify-between">
                    <div>
                      <span class="text-sm font-medium text-indigo-800">Kết quả: </span>
                      <span class="text-sm font-bold text-indigo-600 capitalize">${profile.result_style}</span>
                    </div>
                    ${profile.confidence_score ? `
                      <span class="text-xs text-indigo-600">${Math.round(profile.confidence_score * 100)}% tin cậy</span>
                    ` : ''}
                  </div>
                </div>
              ` : ''}
            </div>
            
            <div class="text-right text-xs text-gray-500">
              <div>ID: ${profile.id}</div>
              <div class="mt-1">${profile.total_pairs || 0}/10 cặp</div>
            </div>
          </div>
        </div>
      `
    }).join('')
  }

  // Update profiles pagination
  updateProfilesPagination(total) {
    const pagination = document.getElementById('profiles-pagination')
    const rangeStart = document.getElementById('profiles-range-start')
    const rangeEnd = document.getElementById('profiles-range-end')
    const totalCount = document.getElementById('profiles-total-count')
    const prevBtn = document.getElementById('profiles-prev-btn')
    const nextBtn = document.getElementById('profiles-next-btn')
    
    if (total === 0) {
      pagination.classList.add('hidden')
      return
    }
    
    pagination.classList.remove('hidden')
    
    const start = this.currentProfilesOffset + 1
    const end = Math.min(this.currentProfilesOffset + this.profilesLimit, total)
    
    rangeStart.textContent = start
    rangeEnd.textContent = end
    totalCount.textContent = total
    
    prevBtn.disabled = this.currentProfilesOffset === 0
    nextBtn.disabled = end >= total
    
    if (prevBtn.disabled) {
      prevBtn.classList.add('opacity-50')
    } else {
      prevBtn.classList.remove('opacity-50')
    }
    
    if (nextBtn.disabled) {
      nextBtn.classList.add('opacity-50')
    } else {
      nextBtn.classList.remove('opacity-50')
    }
  }

  // Scan for content-based duplicates
  async scanContentDuplicates() {
    const scanBtn = document.getElementById('scan-content-duplicates-btn')
    const container = document.getElementById('duplicates-container')
    const summary = document.getElementById('duplicates-summary')
    
    try {
      scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Đang quét nội dung...'
      scanBtn.disabled = true
      
      const response = await fetch('/api/admin/content-duplicates')
      const data = await response.json()
      
      if (data.duplicates && data.duplicates.length > 0) {
        // Show summary
        document.getElementById('duplicate-groups-count').textContent = data.total_groups
        document.getElementById('total-duplicates-count').textContent = data.total_duplicates
        summary.classList.remove('hidden')
        
        // Display duplicates
        container.innerHTML = data.duplicates.map(group => `
          <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h3 class="font-semibold text-purple-800">Ảnh Giống Hệt Nhau (Nội Dung)</h3>
                <p class="text-sm text-purple-600">Hash: ${group.hash} • Kích thước: ${(group.size / 1024).toFixed(1)} KB</p>
                <p class="text-sm text-purple-600">Style: ${group.style} • ${group.count} bản copy</p>
              </div>
              <span class="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm font-medium">
                ${group.count - 1} thừa
              </span>
            </div>
            <div class="text-xs text-gray-600">
              <p>Ảnh giữ lại: ${group.filenames[0]}</p>
              <p>Ảnh sẽ xóa: ${group.filenames.slice(1).join(', ')}</p>
              <p>Từ: ${group.first_upload} đến: ${group.last_upload}</p>
            </div>
          </div>
        `).join('')
      } else {
        container.innerHTML = `
          <div class="text-center text-green-600 py-8">
            <i class="fas fa-check-circle text-4xl mb-4 block"></i>
            <p class="font-medium">Không tìm thấy ảnh trùng lặp nội dung!</p>
          </div>
        `
        summary.classList.add('hidden')
      }
      
    } catch (error) {
      console.error('Error scanning content duplicates:', error)
      container.innerHTML = `
        <div class="text-center text-red-600 py-8">
          <i class="fas fa-exclamation-triangle text-4xl mb-4 block"></i>
          <p>Lỗi khi quét ảnh trùng lặp nội dung</p>
        </div>
      `
    } finally {
      scanBtn.innerHTML = '<i class="fas fa-fingerprint mr-1"></i> Quét Nội Dung'
      scanBtn.disabled = false
    }
  }

  // Clean content-based duplicates
  async cleanContentDuplicates() {
    const confirmMessage = 'BẠN CÓ CHẮC CHẮN MUỐN XÓA TẤT CẢ ẢNH TRÙNG LẶP NỘI DUNG?\n\n' +
                          '⚠️ CẢNH BÁO: Hành động này sẽ:\n' +
                          '• Xóa tất cả ảnh có nội dung giống hệt nhau\n' +
                          '• Giữ lại ảnh cũ nhất trong mỗi nhóm\n' +
                          '• KHÔNG THỂ HOÀN TÁC!'
    
    const confirmation = confirm(confirmMessage)
    
    if (!confirmation) {
      return
    }

    const cleanBtn = document.getElementById('clean-content-duplicates-btn')
    const container = document.getElementById('duplicates-container')
    
    try {
      cleanBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Đang dọn dẹp...'
      cleanBtn.disabled = true
      
      const response = await fetch('/api/admin/content-duplicates', {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        container.innerHTML = `
          <div class="text-center text-green-600 py-8">
            <i class="fas fa-check-circle text-4xl mb-4 block"></i>
            <p class="font-medium">${data.message}</p>
            <p class="text-sm mt-2">Đã xóa ${data.deleted_count} ảnh từ ${data.groups_cleaned} nhóm</p>
          </div>
        `
        document.getElementById('duplicates-summary').classList.add('hidden')
        
        // Refresh image gallery and stats
        await this.loadAdminStats()
        await this.loadImageGallery()
      } else {
        throw new Error(data.error || 'Unknown error')
      }
      
    } catch (error) {
      console.error('Error cleaning content duplicates:', error)
      container.innerHTML = `
        <div class="text-center text-red-600 py-8">
          <i class="fas fa-exclamation-triangle text-4xl mb-4 block"></i>
          <p>Lỗi khi dọn dẹp ảnh trùng lặp nội dung</p>
        </div>
      `
    } finally {
      cleanBtn.innerHTML = '<i class="fas fa-broom mr-1"></i> Dọn Nội Dung'
      cleanBtn.disabled = false
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ArchitectureSurvey()
})