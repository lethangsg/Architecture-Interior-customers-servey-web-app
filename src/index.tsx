import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { renderer } from './renderer'

type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
}

const app = new Hono<{ Bindings: Bindings }>()

// Middleware
app.use('/api/*', cors())
app.use(renderer)

// Utility functions
function generateSessionId(): string {
  return 'session-' + Math.random().toString(36).substring(2) + '-' + Date.now()
}

function extractStyleFromFilename(filename: string): string {
  // Bỏ phần số và extension, lấy phần style
  // Ví dụ: "modern_house_01.jpg" -> "modern"
  return filename.replace(/(_\d+|\d+)?\.(jpg|jpeg|png|webp)$/i, '').replace(/_.*$/, '').toLowerCase()
}

// API Routes

// Tạo session khảo sát mới
app.post('/api/sessions', async (c) => {
  const { env } = c
  const sessionId = generateSessionId()
  const userAgent = c.req.header('User-Agent') || 'Unknown'
  
  try {
    await env.DB.prepare(`
      INSERT INTO survey_sessions (id, user_agent, status)
      VALUES (?, ?, 'active')
    `).bind(sessionId, userAgent).run()

    return c.json({ sessionId, status: 'created' })
  } catch (error) {
    console.error('Error creating session:', error)
    return c.json({ error: 'Failed to create session' }, 500)
  }
})

// Lấy cặp ảnh ngẫu nhiên để so sánh
app.get('/api/sessions/:sessionId/next-pair', async (c) => {
  const { env } = c
  const sessionId = c.req.param('sessionId')

  try {
    // Lấy tất cả ảnh active
    const { results: images } = await env.DB.prepare(`
      SELECT id, filename, style, file_path, original_name 
      FROM architecture_images 
      WHERE is_active = 1
      ORDER BY RANDOM()
      LIMIT 2
    `).all()

    if (images.length < 2) {
      return c.json({ error: 'Not enough images available' }, 400)
    }

    return c.json({
      sessionId,
      leftImage: images[0],
      rightImage: images[1]
    })
  } catch (error) {
    console.error('Error getting image pair:', error)
    return c.json({ error: 'Failed to get image pair' }, 500)
  }
})

// Ghi nhận lựa chọn của người dùng
app.post('/api/sessions/:sessionId/responses', async (c) => {
  const { env } = c
  const sessionId = c.req.param('sessionId')
  const { leftImageId, rightImageId, chosenImageId, responseTime } = await c.req.json()

  try {
    // Ghi nhận response
    await env.DB.prepare(`
      INSERT INTO user_responses (session_id, image_left_id, image_right_id, chosen_image_id, response_time)
      VALUES (?, ?, ?, ?, ?)
    `).bind(sessionId, leftImageId, rightImageId, chosenImageId, responseTime).run()

    // Cập nhật số lượng pairs đã hoàn thành
    await env.DB.prepare(`
      UPDATE survey_sessions 
      SET total_pairs = total_pairs + 1
      WHERE id = ?
    `).bind(sessionId).run()

    // Kiểm tra xem đã đủ 10 pairs chưa
    const { results: sessionData } = await env.DB.prepare(`
      SELECT total_pairs FROM survey_sessions WHERE id = ?
    `).bind(sessionId).all()

    const totalPairs = sessionData[0]?.total_pairs || 0
    
    return c.json({ 
      success: true, 
      totalPairs,
      isComplete: totalPairs >= 10
    })
  } catch (error) {
    console.error('Error saving response:', error)
    return c.json({ error: 'Failed to save response' }, 500)
  }
})

// Tính toán và trả về kết quả khảo sát
app.get('/api/sessions/:sessionId/result', async (c) => {
  const { env } = c
  const sessionId = c.req.param('sessionId')

  try {
    // Lấy tất cả responses của session
    const { results: responses } = await env.DB.prepare(`
      SELECT ai.style, COUNT(*) as count
      FROM user_responses ur
      JOIN architecture_images ai ON ur.chosen_image_id = ai.id
      WHERE ur.session_id = ?
      GROUP BY ai.style
      ORDER BY count DESC
    `).bind(sessionId).all()

    if (responses.length === 0) {
      return c.json({ error: 'No responses found for this session' }, 404)
    }

    const totalResponses = responses.reduce((sum: number, r: any) => sum + r.count, 0)
    const dominantStyle = responses[0].style
    const confidenceScore = responses[0].count / totalResponses

    // Tạo style scores object
    const styleScores: Record<string, number> = {}
    responses.forEach((r: any) => {
      styleScores[r.style] = r.count
    })

    // Lưu kết quả vào database
    await env.DB.prepare(`
      INSERT OR REPLACE INTO session_results 
      (session_id, dominant_style, style_scores, confidence_score, total_responses)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      sessionId, 
      dominantStyle, 
      JSON.stringify(styleScores), 
      confidenceScore, 
      totalResponses
    ).run()

    // Đánh dấu session hoàn thành
    await env.DB.prepare(`
      UPDATE survey_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(sessionId).run()

    return c.json({
      sessionId,
      dominantStyle,
      styleScores,
      confidenceScore: Math.round(confidenceScore * 100),
      totalResponses,
      description: getStyleDescription(dominantStyle)
    })
  } catch (error) {
    console.error('Error calculating result:', error)
    return c.json({ error: 'Failed to calculate result' }, 500)
  }
})

// Admin APIs

// Lấy danh sách tất cả ảnh (admin)
app.get('/api/admin/images', async (c) => {
  const { env } = c
  
  try {
    const { results: images } = await env.DB.prepare(`
      SELECT * FROM architecture_images ORDER BY uploaded_at DESC
    `).all()

    return c.json({ images })
  } catch (error) {
    console.error('Error getting images:', error)
    return c.json({ error: 'Failed to get images' }, 500)
  }
})

// Upload ảnh mới (admin) - placeholder cho R2 upload
app.post('/api/admin/upload', async (c) => {
  const { env } = c
  
  try {
    // Trong thực tế, đây sẽ upload file lên R2 storage
    // Hiện tại chỉ là placeholder để demo
    const formData = await c.req.formData()
    const file = formData.get('image') as File
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }

    const filename = file.name
    const style = extractStyleFromFilename(filename)
    const filePath = `/images/${filename}`
    
    // Lưu thông tin ảnh vào database
    const result = await env.DB.prepare(`
      INSERT INTO architecture_images (filename, style, file_path, original_name)
      VALUES (?, ?, ?, ?)
    `).bind(filename, style, filePath, filename).run()

    return c.json({ 
      success: true, 
      imageId: result.meta.last_row_id,
      filename,
      style,
      message: 'Image uploaded successfully'
    })
  } catch (error) {
    console.error('Error uploading image:', error)
    return c.json({ error: 'Failed to upload image' }, 500)
  }
})

// Lấy thống kê admin
app.get('/api/admin/stats', async (c) => {
  const { env } = c
  
  try {
    const { results: totalSessions } = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM survey_sessions WHERE status = 'completed'
    `).all()

    const { results: stylePopularity } = await env.DB.prepare(`
      SELECT * FROM style_popularity
    `).all()

    const { results: totalImages } = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM architecture_images WHERE is_active = 1
    `).all()

    return c.json({
      totalCompletedSessions: totalSessions[0]?.count || 0,
      totalActiveImages: totalImages[0]?.count || 0,
      stylePopularity: stylePopularity || []
    })
  } catch (error) {
    console.error('Error getting stats:', error)
    return c.json({ error: 'Failed to get statistics' }, 500)
  }
})

// Helper function để mô tả phong cách
function getStyleDescription(style: string): string {
  const descriptions: Record<string, string> = {
    'modern': 'Bạn có xu hướng thích phong cách hiện đại với những đường nét sạch sẽ, tối giản và sử dụng vật liệu công nghệ cao.',
    'classical': 'Bạn yêu thích vẻ đẹp cổ điển với những chi tiết trang trí tinh xảo và kiến trúc truyền thống.',
    'industrial': 'Bạn bị thu hút bởi phong cách công nghiệp với những yếu tố thô ráp, kim loại và không gian mở.',
    'traditional': 'Bạn trân trọng kiến trúc truyền thống với văn hóa bản địa và những giá trị lịch sử.',
    'minimalist': 'Bạn ưa chuộng sự đơn giản, tối giản với nguyên tắc "ít là nhiều".',
    'contemporary': 'Bạn thích những thiết kế đương đại, kết hợp giữa truyền thống và hiện đại.'
  }
  return descriptions[style] || 'Bạn có phong cách kiến trúc độc đáo và thú vị!'
}

// Main Routes

// Trang chủ - Survey Interface
app.get('/', (c) => {
  return c.render(
    <div>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-4">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800">
              <i className="fas fa-building mr-2 text-indigo-600"></i>
              Khảo Sát Phong Cách Kiến Trúc
            </h1>
            <a href="/admin" className="text-sm text-gray-500 hover:text-indigo-600">
              <i className="fas fa-cog"></i>
            </a>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4">
          <div className="max-w-md mx-auto">
            
            {/* Welcome Screen */}
            <div id="welcome-screen" className="text-center space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                  <i className="fas fa-eye text-indigo-600 text-2xl"></i>
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Khám Phá Phong Cách Của Bạn</h2>
                <p className="text-gray-600 leading-relaxed">
                  Chọn 1 trong 2 hình ảnh kiến trúc mà bạn thích hơn. 
                  Sau 10 lượt chọn, chúng tôi sẽ phân tích phong cách kiến trúc của bạn.
                </p>
                <button id="start-survey" className="w-full bg-indigo-600 text-white py-4 px-6 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg">
                  <i className="fas fa-play mr-2"></i>
                  Bắt Đầu Khảo Sát
                </button>
              </div>
            </div>

            {/* Survey Screen */}
            <div id="survey-screen" className="hidden space-y-4">
              {/* Progress */}
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>Tiến độ</span>
                  <span id="progress-text">0/10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div id="progress-bar" className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                </div>
              </div>

              {/* Image Comparison */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="p-4 text-center border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-800">Bạn thích hình nào hơn?</h3>
                  <p className="text-sm text-gray-500">Chạm vào hình ảnh để chọn</p>
                </div>
                
                <div className="flex">
                  <button id="left-choice" className="flex-1 relative overflow-hidden hover:opacity-90 transition-opacity border-r border-gray-100">
                    <img id="left-image" src="" alt="Lựa chọn A" className="w-full h-64 object-cover"/>
                    <div className="absolute inset-0 flex items-end justify-center pb-4">
                      <span className="bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm font-medium">A</span>
                    </div>
                  </button>
                  
                  <button id="right-choice" className="flex-1 relative overflow-hidden hover:opacity-90 transition-opacity">
                    <img id="right-image" src="" alt="Lựa chọn B" className="w-full h-64 object-cover"/>
                    <div className="absolute inset-0 flex items-end justify-center pb-4">
                      <span className="bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm font-medium">B</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Loading */}
              <div id="loading" className="hidden text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="text-gray-600 mt-2">Đang tải cặp ảnh tiếp theo...</p>
              </div>
            </div>

            {/* Result Screen */}
            <div id="result-screen" className="hidden space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <i className="fas fa-check text-green-600 text-2xl"></i>
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Kết Quả Khảo Sát</h2>
                
                <div className="bg-indigo-50 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-indigo-800 mb-2">Phong cách của bạn:</h3>
                  <p id="dominant-style" className="text-2xl font-bold text-indigo-600 capitalize"></p>
                  <p id="confidence" className="text-sm text-indigo-700 mt-1"></p>
                </div>
                
                <div id="style-description" className="text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-4"></div>
                
                <div id="style-breakdown" className="space-y-2"></div>
                
                <button id="restart-survey" className="w-full bg-indigo-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-indigo-700 transition-colors">
                  <i className="fas fa-redo mr-2"></i>
                  Làm Lại Khảo Sát
                </button>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
})

// Admin Interface
app.get('/admin', (c) => {
  return c.render(
    <div>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">
              <i className="fas fa-cogs mr-2 text-indigo-600"></i>
              Admin Dashboard
            </h1>
            <a href="/" className="text-indigo-600 hover:text-indigo-800 font-medium">
              <i className="fas fa-arrow-left mr-1"></i>
              Về Trang Chủ
            </a>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-users text-blue-600 text-xl"></i>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Khảo sát hoàn thành</p>
                  <p id="total-sessions" className="text-2xl font-bold text-gray-900">0</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-images text-green-600 text-xl"></i>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Tổng số ảnh</p>
                  <p id="total-images" className="text-2xl font-bold text-gray-900">0</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-chart-bar text-purple-600 text-xl"></i>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Phong cách phổ biến</p>
                  <p id="popular-style" className="text-lg font-bold text-gray-900 capitalize">-</p>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Section */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              <i className="fas fa-upload mr-2 text-indigo-600"></i>
              Upload Ảnh Mới
            </h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <form id="upload-form" enctype="multipart/form-data">
                <input type="file" id="image-input" accept="image/*" multiple className="hidden"/>
                <label for="image-input" className="cursor-pointer">
                  <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4"></i>
                  <p className="text-lg font-medium text-gray-700">Chọn ảnh để upload</p>
                  <p className="text-sm text-gray-500">Tên file sẽ quyết định phong cách (vd: modern_house_01.jpg)</p>
                </label>
                <button type="submit" className="mt-4 bg-indigo-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                  <i className="fas fa-upload mr-2"></i>
                  Upload
                </button>
              </form>
            </div>
          </div>

          {/* Style Popularity Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              <i className="fas fa-chart-pie mr-2 text-indigo-600"></i>
              Thống Kê Phong Cách
            </h2>
            <div id="style-chart" className="space-y-3">
              {/* Chart will be populated by JavaScript */}
            </div>
          </div>

          {/* Image Gallery */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              <i className="fas fa-th-large mr-2 text-indigo-600"></i>
              Thư Viện Ảnh
            </h2>
            <div id="image-gallery" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {/* Images will be populated by JavaScript */}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
})

export default app