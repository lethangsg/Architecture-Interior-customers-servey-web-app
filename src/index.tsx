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

// Test route for checking real images
app.get('/test-images', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Test Real Images</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 p-8">
        <div class="max-w-6xl mx-auto">
            <h1 class="text-3xl font-bold mb-6">Test Real Architectural Images</h1>
            
            <h2 class="text-xl font-semibold mb-4">Database Images (API)</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div class="bg-white rounded-lg shadow p-4">
                    <h3 class="font-semibold mb-2">Modern (ID:1)</h3>
                    <img src="/api/images/1" alt="Modern" class="w-full h-32 object-cover rounded">
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <h3 class="font-semibold mb-2">Classical (ID:2)</h3>
                    <img src="/api/images/2" alt="Classical" class="w-full h-32 object-cover rounded">
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <h3 class="font-semibold mb-2">Traditional (ID:3)</h3>
                    <img src="/api/images/3" alt="Traditional" class="w-full h-32 object-cover rounded">
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <h3 class="font-semibold mb-2">Contemporary (ID:4)</h3>
                    <img src="/api/images/4" alt="Contemporary" class="w-full h-32 object-cover rounded">
                </div>
            </div>

            <h2 class="text-xl font-semibold mb-4">Sample Images (Direct)</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div class="bg-white rounded-lg shadow p-4">
                    <h3 class="font-semibold mb-2">Modern</h3>
                    <img src="/static/samples/modern.jpg" alt="Modern" class="w-full h-32 object-cover rounded">
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <h3 class="font-semibold mb-2">Art Deco</h3>
                    <img src="/static/samples/art_deco.jpg" alt="Art Deco" class="w-full h-32 object-cover rounded">
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <h3 class="font-semibold mb-2">Mediterranean</h3>
                    <img src="/static/samples/mediterranean.jpg" alt="Mediterranean" class="w-full h-32 object-cover rounded">
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <h3 class="font-semibold mb-2">Craftsman</h3>
                    <img src="/static/samples/craftsman.jpg" alt="Craftsman" class="w-full h-32 object-cover rounded">
                </div>
            </div>
            
            <div class="mt-8">
                <a href="/" class="bg-blue-500 text-white px-4 py-2 rounded mr-4">Back to Main App</a>
                <a href="/admin" class="bg-green-500 text-white px-4 py-2 rounded">Admin Gallery</a>
            </div>
        </div>
    </body>
    </html>
  `)
})

// Static file serving for images and assets
app.get('/images/*', serveStatic({ root: './public' }))
app.get('/static/*', serveStatic({ root: './public' }))
app.get('/favicon.ico', serveStatic({ root: './public' }))



// API endpoint to serve images from database
app.get('/api/images/:id', async (c) => {
  const { env } = c
  const imageId = c.req.param('id')
  
  try {
    // Get image info from database
    const { results: image } = await env.DB.prepare(`
      SELECT * FROM architecture_images WHERE id = ? AND is_active = 1
    `).bind(imageId).all()
    
    if (image.length === 0) {
      return c.notFound()
    }
    
    const imageData = image[0]
    
    // PRIORITY 1: Try to get real image from R2 storage
    try {
      const object = await env.R2.get(imageData.file_path)
      if (object) {
        return new Response(object.body, {
          headers: {
            'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
    } catch (r2Error) {
      console.log('R2 not available or image not found in R2:', r2Error.message)
    }

    // PRIORITY 2: Try to use sample images from public directory
    // Clean style name: replace spaces with underscores, remove trailing spaces
    const cleanStyle = imageData.style.toLowerCase().trim().replace(/\s+/g, '_')
    const category = imageData.category || 'architecture'
    
    // Maps of available sample images by category
    const availableSamples = {
      architecture: [
        'modern', 'classical', 'traditional', 'contemporary', 'minimalist', 'industrial',
        'art_deco', 'mediterranean', 'craftsman', 'bauhaus', 'neoclassic', 'colonial',
        'italian', 'brutalist'
      ],
      interior: [
        'modern', 'traditional', 'contemporary', 'minimalist', 'industrial',
        'art_deco', 'mediterranean', 'bohemian', 'scandinavian', 'rustic', 
        'mid_century', 'eclectic', 'transitional', 'farmhouse'
      ]
    }
    
    const categoryAvailableSamples = availableSamples[category] || availableSamples.architecture
    
    // Check if we have exact sample, otherwise use fallback mapping
    let sampleName = cleanStyle
    if (!categoryAvailableSamples.includes(cleanStyle)) {
      // Fallback mappings for styles without exact samples
      const fallbackMap = {
        architecture: {
          'classic': 'classical',
          'gothic': 'traditional',  
          'tudor': 'traditional',
          'spanish_colonial': 'mediterranean',
          'prairie': 'craftsman',
          'final': 'modern',
          'test': 'modern'
        },
        interior: {
          'classic': 'traditional',
          'classical': 'traditional', 
          'craftsman': 'rustic',
          'bauhaus': 'minimalist',
          'neoclassic': 'traditional',
          'colonial': 'traditional',
          'italian': 'mediterranean',
          'brutalist': 'industrial'
        }
      }
      const categoryFallback = fallbackMap[category] || fallbackMap.architecture
      sampleName = categoryFallback[cleanStyle] || (category === 'interior' ? 'modern' : 'modern')
    }
    
    // Determine sample path based on category
    const sampleDir = category === 'interior' ? 'interior-samples' : 'samples'
    const sampleImagePath = `/static/${sampleDir}/${sampleName}.jpg`
    console.log('🔍 Sample mapping:', imageData.style, 'category:', category, '->', sampleName, 'path:', sampleImagePath)
    
    return c.redirect(sampleImagePath)
    
    // Fallback: return SVG placeholder with architectural style representation
    const safeStyle = imageData.style.replace(/[^\x20-\x7E]/g, '')
    
    // Create style-specific architectural SVG representations
    const getArchitecturalSVG = (style: string, imageId: number) => {
      const styleColors = {
        'modern': { bg: '#1A202C', accent: '#4299E1', text: '#F7FAFC', secondary: '#2D3748' },
        'classical': { bg: '#744210', accent: '#D69E2E', text: '#FFFAF0', secondary: '#B7791F' },
        'industrial': { bg: '#4A5568', accent: '#718096', text: '#F7FAFC', secondary: '#2D3748' },
        'traditional': { bg: '#822727', accent: '#E53E3E', text: '#FFFAF0', secondary: '#C53030' },
        'contemporary': { bg: '#553C9A', accent: '#9F7AEA', text: '#FAF5FF', secondary: '#805AD5' },
        'minimalist': { bg: '#F7FAFC', accent: '#2D3748', text: '#1A202C', secondary: '#E2E8F0' },
        'victorian': { bg: '#553C9A', accent: '#805AD5', text: '#FAF5FF', secondary: '#6B46C1' },
        'colonial': { bg: '#744210', accent: '#B7791F', text: '#FFFAF0', secondary: '#D69E2E' },
        'brutalist': { bg: '#2D3748', accent: '#718096', text: '#F7FAFC', secondary: '#4A5568' },
        'gothic': { bg: '#2B2D42', accent: '#8D99AE', text: '#F8F9FA', secondary: '#495057' },
        'art deco': { bg: '#1A365D', accent: '#4299E1', text: '#F7FAFC', secondary: '#2C5282' },
        'tudor': { bg: '#744210', accent: '#C05621', text: '#FFFAF0', secondary: '#9C4221' },
        'italian': { bg: '#C53030', accent: '#F56565', text: '#FFFAF0', secondary: '#E53E3E' },
        'mediterranean': { bg: '#2C5282', accent: '#4299E1', text: '#F7FAFC', secondary: '#3182CE' },
        'craftsman': { bg: '#744210', accent: '#D69E2E', text: '#FFFAF0', secondary: '#B7791F' },
        'neoclassic': { bg: '#E2E8F0', accent: '#4A5568', text: '#1A202C', secondary: '#CBD5E0' }
      }
      
      const colors = styleColors[style.toLowerCase()] || { bg: '#4A5568', accent: '#9CA3AF', text: '#F7FAFC', secondary: '#718096' }
      
      let buildingStructure = ''
      
      switch(style.toLowerCase()) {
        case 'modern':
          buildingStructure = `
            <rect x="120" y="80" width="160" height="120" fill="${colors.accent}" rx="4"/>
            <rect x="140" y="100" width="30" height="40" fill="${colors.bg}" opacity="0.8"/>
            <rect x="180" y="100" width="30" height="40" fill="${colors.bg}" opacity="0.8"/>
            <rect x="220" y="100" width="30" height="40" fill="${colors.bg}" opacity="0.8"/>
            <rect x="140" y="150" width="30" height="40" fill="${colors.bg}" opacity="0.8"/>
            <rect x="180" y="150" width="30" height="40" fill="${colors.bg}" opacity="0.8"/>
            <rect x="220" y="150" width="30" height="40" fill="${colors.bg}" opacity="0.8"/>
            <rect x="100" y="200" width="200" height="8" fill="${colors.accent}"/>
          `
          break
        case 'classical':
          buildingStructure = `
            <rect x="100" y="180" width="200" height="20" fill="${colors.accent}"/>
            <rect x="130" y="90" width="20" height="90" fill="${colors.accent}"/>
            <rect x="160" y="90" width="20" height="90" fill="${colors.accent}"/>
            <rect x="190" y="90" width="20" height="90" fill="${colors.accent}"/>
            <rect x="220" y="90" width="20" height="90" fill="${colors.accent}"/>
            <rect x="250" y="90" width="20" height="90" fill="${colors.accent}"/>
            <polygon points="120,90 200,60 280,90" fill="${colors.accent}"/>
            <rect x="180" y="120" width="40" height="60" fill="${colors.bg}" opacity="0.9"/>
          `
          break
        case 'industrial':
          buildingStructure = `
            <rect x="80" y="120" width="240" height="80" fill="${colors.accent}"/>
            <rect x="100" y="100" width="40" height="100" fill="${colors.accent}"/>
            <rect x="150" y="80" width="40" height="120" fill="${colors.accent}"/>
            <rect x="200" y="90" width="40" height="110" fill="${colors.accent}"/>
            <rect x="250" y="100" width="40" height="100" fill="${colors.accent}"/>
            <rect x="110" y="110" width="20" height="20" fill="${colors.bg}" opacity="0.8"/>
            <rect x="160" y="90" width="20" height="20" fill="${colors.bg}" opacity="0.8"/>
            <rect x="210" y="100" width="20" height="20" fill="${colors.bg}" opacity="0.8"/>
            <rect x="260" y="110" width="20" height="20" fill="${colors.bg}" opacity="0.8"/>
          `
          break
        case 'traditional':
          buildingStructure = `
            <polygon points="200,70 140,120 260,120" fill="${colors.accent}"/>
            <rect x="150" y="120" width="100" height="80" fill="${colors.accent}"/>
            <rect x="180" y="140" width="15" height="25" fill="${colors.bg}" opacity="0.9"/>
            <rect x="205" y="140" width="15" height="25" fill="${colors.bg}" opacity="0.9"/>
            <rect x="190" y="170" width="20" height="30" fill="${colors.bg}" opacity="0.9"/>
            <rect x="120" y="140" width="25" height="60" fill="${colors.accent}"/>
            <rect x="255" y="140" width="25" height="60" fill="${colors.accent}"/>
          `
          break
        case 'art deco':
          buildingStructure = `
            <rect x="100" y="60" width="200" height="140" fill="${colors.accent}"/>
            <polygon points="120,60 180,40 220,40 280,60" fill="${colors.secondary}"/>
            <rect x="140" y="80" width="20" height="60" fill="${colors.bg}" opacity="0.8"/>
            <rect x="170" y="80" width="20" height="60" fill="${colors.bg}" opacity="0.8"/>
            <rect x="210" y="80" width="20" height="60" fill="${colors.bg}" opacity="0.8"/>
            <rect x="240" y="80" width="20" height="60" fill="${colors.bg}" opacity="0.8"/>
            <rect x="190" y="150" width="20" height="50" fill="${colors.bg}" opacity="0.9"/>
            <rect x="120" y="70" width="160" height="4" fill="${colors.secondary}"/>
          `
          break
        case 'tudor':
          buildingStructure = `
            <polygon points="200,60 130,110 270,110" fill="${colors.accent}"/>
            <rect x="140" y="110" width="120" height="90" fill="${colors.secondary}"/>
            <rect x="160" y="130" width="15" height="25" fill="${colors.bg}" opacity="0.9"/>
            <rect x="185" y="130" width="15" height="25" fill="${colors.bg}" opacity="0.9"/>
            <rect x="210" y="130" width="15" height="25" fill="${colors.bg}" opacity="0.9"/>
            <rect x="235" y="130" width="15" height="25" fill="${colors.bg}" opacity="0.9"/>
            <rect x="190" y="170" width="20" height="30" fill="${colors.bg}" opacity="0.9"/>
            <rect x="150" y="115" width="100" height="8" fill="${colors.accent}"/>
          `
          break
        case 'italian':
          buildingStructure = `
            <rect x="120" y="80" width="160" height="120" fill="${colors.accent}"/>
            <rect x="140" y="100" width="25" height="35" fill="${colors.bg}" opacity="0.8"/>
            <rect x="175" y="100" width="25" height="35" fill="${colors.bg}" opacity="0.8"/>
            <rect x="210" y="100" width="25" height="35" fill="${colors.bg}" opacity="0.8"/>
            <rect x="245" y="100" width="25" height="35" fill="${colors.bg}" opacity="0.8"/>
            <rect x="185" y="150" width="30" height="50" fill="${colors.bg}" opacity="0.9"/>
            <rect x="100" y="200" width="200" height="6" fill="${colors.secondary}"/>
            <circle cx="200" cy="70" r="8" fill="${colors.secondary}"/>
          `
          break
        case 'mediterranean':
          buildingStructure = `
            <rect x="120" y="90" width="160" height="110" fill="${colors.accent}"/>
            <circle cx="200" cy="90" r="25" fill="${colors.secondary}"/>
            <rect x="145" y="120" width="20" height="30" fill="${colors.bg}" opacity="0.8"/>
            <rect x="175" y="120" width="20" height="30" fill="${colors.bg}" opacity="0.8"/>
            <rect x="205" y="120" width="20" height="30" fill="${colors.bg}" opacity="0.8"/>
            <rect x="235" y="120" width="20" height="30" fill="${colors.bg}" opacity="0.8"/>
            <rect x="185" y="165" width="30" height="35" fill="${colors.bg}" opacity="0.9"/>
            <rect x="100" y="200" width="200" height="8" fill="${colors.secondary}"/>
          `
          break
        case 'craftsman':
          buildingStructure = `
            <polygon points="200,65 140,105 260,105" fill="${colors.accent}"/>
            <rect x="150" y="105" width="100" height="95" fill="${colors.secondary}"/>
            <rect x="170" y="125" width="15" height="25" fill="${colors.bg}" opacity="0.9"/>
            <rect x="195" y="125" width="15" height="25" fill="${colors.bg}" opacity="0.9"/>
            <rect x="220" y="125" width="15" height="25" fill="${colors.bg}" opacity="0.9"/>
            <rect x="185" y="160" width="25" height="40" fill="${colors.bg}" opacity="0.9"/>
            <rect x="130" y="125" width="15" height="75" fill="${colors.accent}"/>
            <rect x="255" y="125" width="15" height="75" fill="${colors.accent}"/>
            <rect x="140" y="110" width="120" height="6" fill="${colors.accent}"/>
          `
          break
        case 'neoclassic':
          buildingStructure = `
            <rect x="100" y="180" width="200" height="20" fill="${colors.secondary}"/>
            <rect x="125" y="85" width="18" height="95" fill="${colors.accent}"/>
            <rect x="155" y="85" width="18" height="95" fill="${colors.accent}"/>
            <rect x="185" y="85" width="18" height="95" fill="${colors.accent}"/>
            <rect x="215" y="85" width="18" height="95" fill="${colors.accent}"/>
            <rect x="245" y="85" width="18" height="95" fill="${colors.accent}"/>
            <rect x="275" y="85" width="18" height="95" fill="${colors.accent}"/>
            <polygon points="110,85 200,55 290,85" fill="${colors.accent}"/>
            <rect x="180" y="115" width="40" height="65" fill="${colors.bg}" opacity="0.9"/>
            <rect x="110" y="90" width="180" height="4" fill="${colors.secondary}"/>
          `
          break
        default:
          buildingStructure = `
            <rect x="140" y="100" width="120" height="100" fill="${colors.accent}" rx="6"/>
            <rect x="160" y="120" width="25" height="30" fill="${colors.bg}" opacity="0.8"/>
            <rect x="195" y="120" width="25" height="30" fill="${colors.bg}" opacity="0.8"/>
            <rect x="230" y="120" width="25" height="30" fill="${colors.bg}" opacity="0.8"/>
            <rect x="177" y="170" width="25" height="30" fill="${colors.bg}" opacity="0.9"/>
          `
      }
      
      return `<svg width="400" height="256" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 256">
        <defs>
          <linearGradient id="skyGrad${imageId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${colors.bg};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${colors.bg};stop-opacity:0.8" />
          </linearGradient>
        </defs>
        <rect width="400" height="256" fill="url(#skyGrad${imageId})"/>
        ${buildingStructure}
        <text x="200" y="230" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="${colors.text}" text-anchor="middle" font-weight="600">${safeStyle.toUpperCase()}</text>
        <text x="200" y="245" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="${colors.text}" text-anchor="middle" opacity="0.7">Architectural Style Preview</text>
      </svg>`
    }
    
    const svgContent = getArchitecturalSVG(safeStyle, imageData.id)
    
    return new Response(svgContent, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600'
      }
    })
    
  } catch (error) {
    console.error('Error serving image:', error)
    return c.text('Image not found', 404)
  }
})

// API Routes

// Tạo session khảo sát mới (hỗ trợ category và demographics)
app.post('/api/sessions', async (c) => {
  const { env } = c
  const sessionId = generateSessionId()
  const userAgent = c.req.header('User-Agent') || 'Unknown'
  const { 
    category, 
    user_name, 
    user_email, 
    user_phone, 
    user_location,
    user_age_range,
    user_gender 
  } = await c.req.json()
  const surveyCategory = category || 'architecture' // Default to architecture
  
  try {
    await env.DB.prepare(`
      INSERT INTO survey_sessions (
        id, user_agent, status, survey_category,
        user_name, user_email, user_phone, user_location,
        user_age_range, user_gender
      )
      VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionId, userAgent, surveyCategory,
      user_name || null, user_email || null, user_phone || null, user_location || null,
      user_age_range || null, user_gender || null
    ).run()

    return c.json({ sessionId, category: surveyCategory, status: 'created' })
  } catch (error) {
    console.error('Error creating session:', error)
    return c.json({ error: 'Failed to create session' }, 500)
  }
})

// Lấy 2 ảnh ngẫu nhiên để so sánh (hỗ trợ category)
app.get('/api/sessions/:sessionId/next-pair', async (c) => {
  const { env } = c
  const sessionId = c.req.param('sessionId')

  try {
    // Get session to determine category
    const { results: sessionData } = await env.DB.prepare(`
      SELECT survey_category FROM survey_sessions WHERE id = ?
    `).bind(sessionId).all()

    const category = sessionData[0]?.survey_category || 'architecture'

    // Ensure category column exists (simple migration)
    try {
      await env.DB.prepare(`
        ALTER TABLE architecture_images ADD COLUMN category TEXT DEFAULT 'architecture'
      `).run()
      await env.DB.prepare(`
        UPDATE architecture_images SET category = 'architecture' WHERE category IS NULL
      `).run()
    } catch (e) {
      // Column already exists
    }

    // Lấy 2 ảnh active ngẫu nhiên theo category
    const { results: images } = await env.DB.prepare(`
      SELECT id, filename, style, file_path, original_name, category
      FROM architecture_images 
      WHERE is_active = 1 AND category = ?
      ORDER BY RANDOM()
      LIMIT 2
    `).bind(category).all()

    if (images.length < 2) {
      return c.json({ error: `Not enough ${category} images available (need at least 2)` }, 400)
    }

    return c.json({
      sessionId,
      category,
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
  const { leftImageId, rightImageId, chosenImageId, responseTime, isSkipped } = await c.req.json()

  try {
    // Đảm bảo có cột is_skipped (migration đơn giản trong code)
    try {
      await env.DB.prepare(`
        ALTER TABLE user_responses ADD COLUMN is_skipped BOOLEAN DEFAULT 0
      `).run()
    } catch (e) {
      // Column đã tồn tại, bỏ qua lỗi
    }

    // Ghi nhận response với skip option
    // Nếu skip, chọn một trong 2 ảnh làm chosen_image_id để tránh NOT NULL constraint
    // Nhưng đánh dấu is_skipped = 1 để biết đây là skip
    const actualChosenImageId = isSkipped ? leftImageId : chosenImageId
    
    await env.DB.prepare(`
      INSERT INTO user_responses (session_id, image_left_id, image_right_id, chosen_image_id, response_time, is_skipped)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      sessionId, 
      leftImageId, 
      rightImageId, 
      actualChosenImageId, 
      responseTime,
      isSkipped ? 1 : 0
    ).run()

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
    // Lấy tất cả responses của session (bỏ qua các responses bị skip)
    const { results: responses } = await env.DB.prepare(`
      SELECT ai.style, COUNT(*) as count
      FROM user_responses ur
      JOIN architecture_images ai ON ur.chosen_image_id = ai.id
      WHERE ur.session_id = ? AND (ur.is_skipped IS NULL OR ur.is_skipped = 0)
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

// Lấy danh sách tất cả ảnh (admin) - hỗ trợ category filter
app.get('/api/admin/images', async (c) => {
  const { env } = c
  const category = c.req.query('category') // 'architecture', 'interior', 'all'
  
  try {
    // Ensure category column exists
    try {
      await env.DB.prepare(`
        ALTER TABLE architecture_images ADD COLUMN category TEXT DEFAULT 'architecture'
      `).run()
      await env.DB.prepare(`
        UPDATE architecture_images SET category = 'architecture' WHERE category IS NULL
      `).run()
    } catch (e) {
      // Column already exists
    }

    let query = 'SELECT * FROM architecture_images'
    let params = []
    
    if (category && category !== 'all') {
      query += ' WHERE category = ?'
      params.push(category)
    }
    
    query += ' ORDER BY uploaded_at DESC'
    
    const { results: images } = await env.DB.prepare(query).bind(...params).all()

    return c.json({ images, category: category || 'all' })
  } catch (error) {
    console.error('Error getting images:', error)
    return c.json({ error: 'Failed to get images' }, 500)
  }
})

// Upload ảnh mới (admin) - placeholder cho R2 upload với category support
app.post('/api/admin/upload', async (c) => {
  const { env } = c
  
  try {
    const formData = await c.req.formData()
    const file = formData.get('image') as File
    const category = formData.get('category') as string || 'architecture'
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return c.json({ error: 'File must be an image' }, 400)
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: 'File size must be less than 5MB' }, 400)
    }

    // Validate category
    if (!['architecture', 'interior'].includes(category)) {
      return c.json({ error: 'Invalid category' }, 400)
    }

    const filename = file.name
    const style = extractStyleFromFilename(filename)
    const timestamp = Date.now()
    const safeFilename = `${timestamp}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const filePath = `/images/${safeFilename}`
    
    try {
      // Upload to R2 storage
      const fileBuffer = await file.arrayBuffer()
      await env.R2.put(filePath, fileBuffer, {
        httpMetadata: {
          contentType: file.type,
        },
      })
      
      console.log(`✅ File uploaded to R2: ${filePath}`)
    } catch (r2Error) {
      console.log('⚠️ R2 upload failed, continuing with metadata only:', r2Error.message)
      // Continue with metadata-only approach if R2 fails
    }
    
    // Ensure category column exists
    try {
      await env.DB.prepare(`
        ALTER TABLE architecture_images ADD COLUMN category TEXT DEFAULT 'architecture'
      `).run()
    } catch (e) {
      // Column already exists
    }
    
    // Save image metadata to database with category
    const result = await env.DB.prepare(`
      INSERT INTO architecture_images (filename, style, file_path, original_name, category)
      VALUES (?, ?, ?, ?, ?)
    `).bind(safeFilename, style, filePath, filename, category).run()

    return c.json({ 
      success: true, 
      imageId: result.meta.last_row_id,
      filename: safeFilename,
      originalName: filename,
      style,
      category,
      filePath,
      message: 'Image uploaded successfully'
    })
  } catch (error) {
    console.error('Error uploading image:', error)
    return c.json({ error: 'Failed to upload image' }, 500)
  }
})

// Lấy thống kê admin với category breakdown và demographics
app.get('/api/admin/stats', async (c) => {
  const { env } = c
  
  try {
    // Overall stats
    const { results: totalSessions } = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM survey_sessions WHERE status = 'completed'
    `).all()

    // Category breakdown for sessions
    const { results: sessionsByCategory } = await env.DB.prepare(`
      SELECT 
        survey_category as category,
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions
      FROM survey_sessions 
      GROUP BY survey_category
    `).all()

    // Category breakdown for images
    const { results: imagesByCategory } = await env.DB.prepare(`
      SELECT 
        category,
        COUNT(*) as total_images,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_images
      FROM architecture_images 
      GROUP BY category
    `).all()

    // Style popularity (overall)
    const { results: stylePopularity } = await env.DB.prepare(`
      SELECT * FROM style_popularity
    `).all()

    // Style popularity by category
    const { results: stylePopularityByCategory } = await env.DB.prepare(`
      SELECT 
        ss.survey_category as category,
        sr.dominant_style as style,
        COUNT(*) as preference_count,
        ROUND(AVG(sr.confidence_score), 2) as avg_confidence
      FROM survey_sessions ss
      JOIN session_results sr ON ss.id = sr.session_id
      WHERE ss.status = 'completed'
      GROUP BY ss.survey_category, sr.dominant_style
      ORDER BY ss.survey_category, preference_count DESC
    `).all()

    // Demographics analytics
    const { results: demographicsStats } = await env.DB.prepare(`
      SELECT 
        survey_category,
        user_age_range,
        user_gender,
        COUNT(*) as session_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
      FROM survey_sessions 
      WHERE user_name IS NOT NULL OR user_email IS NOT NULL
      GROUP BY survey_category, user_age_range, user_gender
      ORDER BY survey_category, session_count DESC
    `).all()

    // Location stats
    const { results: locationStats } = await env.DB.prepare(`
      SELECT 
        survey_category,
        user_location,
        COUNT(*) as session_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
      FROM survey_sessions 
      WHERE user_location IS NOT NULL AND user_location != ''
      GROUP BY survey_category, user_location
      ORDER BY survey_category, session_count DESC
    `).all()

    return c.json({
      // Overall stats (backward compatibility)
      totalCompletedSessions: totalSessions[0]?.count || 0,
      totalActiveImages: imagesByCategory.reduce((sum, cat) => sum + (cat.active_images || 0), 0),
      stylePopularity: stylePopularity || [],
      
      // New category-specific stats
      sessionsByCategory: sessionsByCategory || [],
      imagesByCategory: imagesByCategory || [],
      stylePopularityByCategory: stylePopularityByCategory || [],
      
      // Demographics analytics
      demographicsStats: demographicsStats || [],
      locationStats: locationStats || []
    })
  } catch (error) {
    console.error('Error getting stats:', error)
    return c.json({ error: 'Failed to get statistics' }, 500)
  }
})

// Cập nhật thông tin ảnh (admin)
app.put('/api/admin/images/:id', async (c) => {
  const { env } = c
  const imageId = c.req.param('id')
  const { filename, style, original_name, is_active } = await c.req.json()
  
  try {
    const result = await env.DB.prepare(`
      UPDATE architecture_images 
      SET filename = ?, style = ?, original_name = ?, is_active = ?
      WHERE id = ?
    `).bind(filename, style, original_name, is_active ? 1 : 0, imageId).run()

    if (result.changes === 0) {
      return c.json({ error: 'Image not found' }, 404)
    }

    return c.json({ 
      success: true, 
      message: 'Image updated successfully' 
    })
  } catch (error) {
    console.error('Error updating image:', error)
    return c.json({ error: 'Failed to update image' }, 500)
  }
})

// API để tìm ảnh trùng lặp dựa trên nội dung thật (admin)
app.get('/api/admin/content-duplicates', async (c) => {
  const { env } = c
  
  try {
    // Get all images
    const { results: images } = await env.DB.prepare(`
      SELECT id, filename, original_name, style, uploaded_at, category
      FROM architecture_images 
      ORDER BY uploaded_at ASC
    `).all()

    // Group images by content hash
    const hashGroups = {}
    const imageDetails = []
    
    for (const image of images) {
      try {
        // Get image content from R2 or file system
        const imageResponse = await fetch(`${new URL(c.req.url).origin}/api/images/${image.id}`)
        if (imageResponse.ok) {
          const buffer = await imageResponse.arrayBuffer()
          
          // Create hash of content using Web Crypto API
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
          
          const details = {
            ...image,
            size: buffer.byteLength,
            hash: hashHex
          }
          
          imageDetails.push(details)
          
          if (!hashGroups[hashHex]) {
            hashGroups[hashHex] = []
          }
          hashGroups[hashHex].push(details)
        }
      } catch (error) {
        console.error(`Error processing image ${image.id}:`, error)
      }
    }

    // Find groups with exact duplicates
    const duplicateGroups = Object.values(hashGroups)
      .filter(group => group.length > 1)
      .map(group => {
        const sortedImages = group.sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at))
        return {
          hash: sortedImages[0].hash.substring(0, 16) + '...', // Show partial hash
          size: sortedImages[0].size,
          style: sortedImages[0].style,
          category: sortedImages[0].category,
          count: sortedImages.length,
          ids: sortedImages.map(img => img.id),
          filenames: sortedImages.map(img => img.filename),
          first_upload: sortedImages[0].uploaded_at,
          last_upload: sortedImages[sortedImages.length - 1].uploaded_at,
          keep_id: sortedImages[0].id, // Keep the oldest one
          remove_ids: sortedImages.slice(1).map(img => img.id) // Remove the rest
        }
      })

    const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + (group.count - 1), 0)

    return c.json({
      duplicates: duplicateGroups,
      total_groups: duplicateGroups.length,
      total_duplicates: totalDuplicates,
      detection_method: 'content_hash'
    })

  } catch (error) {
    console.error('Error scanning for content duplicates:', error)
    return c.json({ error: 'Failed to scan for content duplicates' }, 500)
  }
})

// API để tìm ảnh trùng lặp dựa trên filename (admin) 
app.get('/api/admin/duplicates', async (c) => {
  const { env } = c
  
  try {
    // Tìm ảnh trùng lặp dựa trên filename (bỏ phần timestamp)
    const { results: images } = await env.DB.prepare(`
      SELECT id, filename, original_name, style, uploaded_at, category
      FROM architecture_images 
      ORDER BY uploaded_at ASC
    `).all()

    // Group images by their original filename pattern AND category
    const groups = {}
    
    images.forEach(image => {
      // Extract base filename without timestamp and random suffixes
      let baseFilename = image.original_name || image.filename
      
      // Remove timestamp prefix (e.g., "1756084567890_" from filename)
      baseFilename = baseFilename.replace(/^\d+_/, '')
      
      // Remove common suffixes like _01, _02, _copy, _duplicate, etc.
      baseFilename = baseFilename.replace(/(_\d+|_copy|_duplicate|_\(\d+\))\.(jpg|jpeg|png|webp)$/i, '.$2')
      
      // Normalize to lowercase for comparison
      const normalizedName = baseFilename.toLowerCase()
      
      // Include category in grouping key to avoid cross-category false positives
      const groupKey = `${image.category}_${normalizedName}`
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          baseFilename: baseFilename,
          images: []
        }
      }
      
      groups[groupKey].images.push(image)
    })

    // Find groups with duplicates (more than 1 image)
    const duplicateGroups = Object.values(groups)
      .filter(group => group.images.length > 1)
      .map(group => {
        const sortedImages = group.images.sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at))
        return {
          filename: group.baseFilename,
          style: sortedImages[0].style,
          category: sortedImages[0].category,
          count: sortedImages.length,
          ids: sortedImages.map(img => img.id),
          first_upload: sortedImages[0].uploaded_at,
          last_upload: sortedImages[sortedImages.length - 1].uploaded_at,
          keep_id: sortedImages[0].id, // Keep the oldest one
          remove_ids: sortedImages.slice(1).map(img => img.id) // Remove the rest
        }
      })

    const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + (group.count - 1), 0)

    return c.json({
      duplicates: duplicateGroups,
      total_groups: duplicateGroups.length,
      total_duplicates: totalDuplicates
    })

  } catch (error) {
    console.error('Error scanning for duplicates:', error)
    return c.json({ error: 'Failed to scan for duplicates' }, 500)
  }
})

// API để xóa tất cả ảnh theo category (admin)
app.delete('/api/admin/images/category/:category', async (c) => {
  const { env } = c
  const category = c.req.param('category')
  
  if (!category || !['architecture', 'interior'].includes(category)) {
    return c.json({ error: 'Invalid category' }, 400)
  }
  
  try {
    // Get all image IDs for this category
    const { results: images } = await env.DB.prepare(`
      SELECT id FROM architecture_images WHERE category = ?
    `).bind(category).all()
    
    if (!images || images.length === 0) {
      return c.json({
        success: true,
        deleted_count: 0,
        message: `Không có ảnh ${category === 'architecture' ? 'kiến trúc' : 'nội thất'} nào để xóa`
      })
    }

    const imageIds = images.map(img => img.id)
    let deletedCount = 0
    let errorCount = 0

    // Delete all images in this category
    for (const imageId of imageIds) {
      try {
        // Delete from responses table first (foreign key constraint)
        await env.DB.prepare(`
          DELETE FROM user_responses 
          WHERE chosen_image_id = ? OR image_left_id = ? OR image_right_id = ?
        `).bind(imageId, imageId, imageId).run()
        
        // Delete from images table
        await env.DB.prepare(`
          DELETE FROM architecture_images WHERE id = ?
        `).bind(imageId).run()
        
        deletedCount++
      } catch (deleteError) {
        console.error(`Error deleting image ${imageId}:`, deleteError)
        errorCount++
      }
    }

    const categoryName = category === 'architecture' ? 'kiến trúc' : 'nội thất'
    
    return c.json({
      success: true,
      deleted_count: deletedCount,
      error_count: errorCount,
      category: category,
      message: `Đã xóa ${deletedCount} ảnh ${categoryName}${errorCount > 0 ? `, ${errorCount} lỗi` : ''}`
    })

  } catch (error) {
    console.error(`Error deleting all ${category} images:`, error)
    return c.json({ error: `Failed to delete all ${category} images` }, 500)
  }
})

// API để xóa tất cả ảnh (admin)
app.delete('/api/admin/images/all', async (c) => {
  const { env } = c
  
  try {
    // Get all image IDs first
    const { results: images } = await env.DB.prepare(`
      SELECT id FROM architecture_images
    `).all()
    
    if (!images || images.length === 0) {
      return c.json({
        success: true,
        deleted_count: 0,
        message: 'Không có ảnh nào để xóa'
      })
    }

    const imageIds = images.map(img => img.id)
    let deletedCount = 0
    let errorCount = 0

    // Delete all images one by one to handle foreign key constraints properly
    for (const imageId of imageIds) {
      try {
        // Delete from responses table first (foreign key constraint)
        await env.DB.prepare(`
          DELETE FROM user_responses 
          WHERE chosen_image_id = ? OR image_left_id = ? OR image_right_id = ?
        `).bind(imageId, imageId, imageId).run()
        
        // Delete from images table
        await env.DB.prepare(`
          DELETE FROM architecture_images WHERE id = ?
        `).bind(imageId).run()
        
        deletedCount++
      } catch (deleteError) {
        console.error(`Error deleting image ${imageId}:`, deleteError)
        errorCount++
      }
    }

    // Clean up session results that might reference deleted images
    await env.DB.prepare(`
      DELETE FROM session_results WHERE session_id IN (
        SELECT id FROM survey_sessions WHERE status = 'active'
      )
    `).run()

    return c.json({
      success: true,
      deleted_count: deletedCount,
      error_count: errorCount,
      message: `Đã xóa ${deletedCount} ảnh${errorCount > 0 ? `, ${errorCount} lỗi` : ''}`
    })

  } catch (error) {
    console.error('Error deleting all images:', error)
    return c.json({ error: 'Failed to delete all images' }, 500)
  }
})

// API để xóa ảnh trùng lặp dựa trên nội dung (admin)
app.delete('/api/admin/content-duplicates', async (c) => {
  const { env } = c
  
  try {
    // Get content duplicates first using the same logic as scan
    const scanResponse = await fetch(`${c.req.url.split('/api')[0]}/api/admin/content-duplicates`)
    const scanData = await scanResponse.json()
    
    if (!scanData.duplicates || scanData.duplicates.length === 0) {
      return c.json({ success: true, deleted_count: 0, groups_cleaned: 0, message: 'Không có ảnh trùng lặp nội dung nào' })
    }

    let deletedCount = 0
    let groupsCleaned = 0

    // Delete duplicates (keep oldest in each group)
    for (const group of scanData.duplicates) {
      for (const imageId of group.remove_ids) {
        try {
          // Delete from responses table first (foreign key constraint)
          await env.DB.prepare(`
            DELETE FROM user_responses 
            WHERE chosen_image_id = ? OR image_left_id = ? OR image_right_id = ?
          `).bind(imageId, imageId, imageId).run()
          
          // Delete from images table
          await env.DB.prepare(`
            DELETE FROM architecture_images WHERE id = ?
          `).bind(imageId).run()
          
          deletedCount++
        } catch (error) {
          console.error(`Error deleting duplicate image ${imageId}:`, error)
        }
      }
      groupsCleaned++
    }

    return c.json({
      success: true,
      deleted_count: deletedCount,
      groups_cleaned: groupsCleaned,
      message: `Đã xóa ${deletedCount} ảnh trùng lặp nội dung từ ${groupsCleaned} nhóm`
    })

  } catch (error) {
    console.error('Error cleaning content duplicates:', error)
    return c.json({ error: 'Failed to clean content duplicates' }, 500)
  }
})

// API để xóa ảnh trùng lặp dựa trên filename (admin)
app.delete('/api/admin/duplicates', async (c) => {
  const { env } = c
  
  try {
    // Get duplicate groups first
    const duplicatesResponse = await env.DB.prepare(`
      SELECT id, filename, original_name, style, uploaded_at, category
      FROM architecture_images 
      ORDER BY uploaded_at ASC
    `).all()

    const groups = {}
    duplicatesResponse.results.forEach(image => {
      let baseFilename = image.original_name || image.filename
      baseFilename = baseFilename.replace(/^\d+_/, '')
      baseFilename = baseFilename.replace(/(_\d+|_copy|_duplicate|_\(\d+\))\.(jpg|jpeg|png|webp)$/i, '.$2')
      const normalizedName = baseFilename.toLowerCase()
      
      // Include category in grouping key to avoid cross-category false positives
      const groupKey = `${image.category}_${normalizedName}`
      
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(image)
    })

    const duplicateGroups = Object.values(groups).filter(group => group.length > 1)
    let deletedCount = 0
    let groupsCleaned = 0

    // Delete duplicates (keep oldest in each group)
    for (const group of duplicateGroups) {
      const sortedImages = group.sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at))
      const toDelete = sortedImages.slice(1) // Remove all except first (oldest)
      
      for (const image of toDelete) {
        try {
          // Delete from responses table first (foreign key constraint)
          await env.DB.prepare(`
            DELETE FROM user_responses 
            WHERE chosen_image_id = ? OR image_left_id = ? OR image_right_id = ?
          `).bind(image.id, image.id, image.id).run()
          
          // Delete from images table
          await env.DB.prepare(`
            DELETE FROM architecture_images WHERE id = ?
          `).bind(image.id).run()
          
          deletedCount++
        } catch (deleteError) {
          console.error(`Error deleting duplicate image ${image.id}:`, deleteError)
        }
      }
      groupsCleaned++
    }

    return c.json({
      success: true,
      deleted_count: deletedCount,
      groups_cleaned: groupsCleaned,
      message: `Đã xóa ${deletedCount} ảnh trùng lặp từ ${groupsCleaned} nhóm`
    })

  } catch (error) {
    console.error('Error cleaning duplicates:', error)
    return c.json({ error: 'Failed to clean duplicates' }, 500)
  }
})

// Xóa ảnh (admin)
app.delete('/api/admin/images/:id', async (c) => {
  const { env } = c
  const imageId = c.req.param('id')
  
  try {
    console.log('🗑️ DELETE request for image ID:', imageId)
    
    // Lấy thông tin ảnh hiện tại
    const { results: imageInfo } = await env.DB.prepare(`
      SELECT is_active FROM architecture_images WHERE id = ?
    `).bind(imageId).all()
    
    console.log('📊 Image info:', imageInfo)

    if (imageInfo.length === 0) {
      return c.json({ error: 'Image not found' }, 404)
    }

    const isCurrentlyActive = imageInfo[0].is_active === 1

    // Kiểm tra xem ảnh có đang được sử dụng trong responses không
    const { results: usageCheck } = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM user_responses 
      WHERE chosen_image_id = ? OR image_left_id = ? OR image_right_id = ?
    `).bind(imageId, imageId, imageId).all()

    const hasResponses = usageCheck[0]?.count > 0
    
    console.log('🔍 Analysis:', { isCurrentlyActive, hasResponses })

    if (hasResponses && isCurrentlyActive) {
      // Nếu ảnh đang active và có responses, chỉ deactivate
      await env.DB.prepare(`
        UPDATE architecture_images SET is_active = 0 WHERE id = ?
      `).bind(imageId).run()
      
      return c.json({ 
        success: true, 
        message: 'Image deactivated (has survey responses)',
        action: 'deactivated'
      })
    } else {
      // Nếu ảnh đã bị tắt hoặc không có responses, có thể xóa hoàn toàn
      console.log('🗑️ Attempting to delete image...')
      
      if (hasResponses) {
        // Nếu có responses, xóa responses trước để tránh foreign key constraint
        console.log('🧹 Cleaning up responses first...')
        await env.DB.prepare(`
          DELETE FROM user_responses 
          WHERE chosen_image_id = ? OR image_left_id = ? OR image_right_id = ?
        `).bind(imageId, imageId, imageId).run()
        console.log('✅ Responses cleaned up')
      }
      
      const result = await env.DB.prepare(`
        DELETE FROM architecture_images WHERE id = ?
      `).bind(imageId).run()
      
      console.log('📊 Delete result:', result)

      if (result.changes === 0) {
        console.log('❌ No changes made, image not found')
        return c.json({ error: 'Image not found' }, 404)
      }

      const reason = !hasResponses ? 'no survey responses' : 'already inactive'
      console.log('✅ Delete successful, reason:', reason)
      return c.json({ 
        success: true, 
        message: 'Image deleted successfully',
        reason: reason,
        action: 'deleted'
      })
    }
  } catch (error) {
    console.error('💥 Error deleting image:', error)
    console.error('Error details:', error.message, error.stack)
    return c.json({ error: 'Failed to delete image' }, 500)
  }
})

// Toggle trạng thái active của ảnh (admin)
app.patch('/api/admin/images/:id/toggle', async (c) => {
  const { env } = c
  const imageId = c.req.param('id')
  
  try {
    // Lấy trạng thái hiện tại
    const { results: currentImage } = await env.DB.prepare(`
      SELECT is_active FROM architecture_images WHERE id = ?
    `).bind(imageId).all()

    if (currentImage.length === 0) {
      return c.json({ error: 'Image not found' }, 404)
    }

    const newStatus = currentImage[0].is_active ? 0 : 1
    
    await env.DB.prepare(`
      UPDATE architecture_images SET is_active = ? WHERE id = ?
    `).bind(newStatus, imageId).run()

    return c.json({ 
      success: true, 
      is_active: newStatus === 1,
      message: newStatus ? 'Image activated' : 'Image deactivated'
    })
  } catch (error) {
    console.error('Error toggling image status:', error)
    return c.json({ error: 'Failed to toggle image status' }, 500)
  }
})

// Tìm kiếm và lọc ảnh (admin) - MUST be before /:id route
app.get('/api/admin/images/search', async (c) => {
  const { env } = c
  const style = c.req.query('style')
  const status = c.req.query('status') // 'active', 'inactive', 'all'
  const category = c.req.query('category') // 'architecture', 'interior', 'all'
  const search = c.req.query('search') // search in filename
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')
  
  try {
    // Ensure category column exists
    try {
      await env.DB.prepare(`
        ALTER TABLE architecture_images ADD COLUMN category TEXT DEFAULT 'architecture'
      `).run()
      await env.DB.prepare(`
        UPDATE architecture_images SET category = 'architecture' WHERE category IS NULL
      `).run()
    } catch (e) {
      // Column already exists
    }

    let whereConditions = []
    let params: any[] = []

    if (category && category !== 'all') {
      whereConditions.push('category = ?')
      params.push(category)
    }

    if (style && style !== 'all') {  
      whereConditions.push('TRIM(style) = ?')
      params.push(style.trim())
    }

    if (status === 'active') {
      whereConditions.push('is_active = 1')
    } else if (status === 'inactive') {
      whereConditions.push('is_active = 0')
    }

    if (search) {
      whereConditions.push('(filename LIKE ? OR original_name LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''
    
    const { results: images } = await env.DB.prepare(`
      SELECT * FROM architecture_images 
      ${whereClause}
      ORDER BY uploaded_at DESC 
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all()

    // Build count query with same parameters
    const countQuery = env.DB.prepare(`
      SELECT COUNT(*) as count FROM architecture_images ${whereClause}
    `)
    
    const { results: totalCount } = params.length > 0 ? 
      await countQuery.bind(...params).all() : 
      await countQuery.all()

    return c.json({
      images,
      total: totalCount[0]?.count || 0,
      limit,
      offset,
      hasMore: (totalCount[0]?.count || 0) > offset + limit
    })
  } catch (error) {
    console.error('Error searching images:', error)
    return c.json({ error: 'Failed to search images' }, 500)
  }
})

// API để lấy danh sách ảnh trùng lặp (admin)
app.get('/api/admin/duplicates', async (c) => {
  const { env } = c
  
  try {
    const { results: duplicates } = await env.DB.prepare(`
      SELECT 
        filename,
        TRIM(style) as style,
        COUNT(*) as count,
        GROUP_CONCAT(id) as ids,
        MIN(uploaded_at) as first_upload,
        MAX(uploaded_at) as last_upload
      FROM architecture_images 
      WHERE is_active = 1
      GROUP BY filename, TRIM(style)
      HAVING count > 1
      ORDER BY count DESC, filename
    `).all()

    // Parse IDs from string to array
    const duplicatesWithParsedIds = duplicates.map(dup => ({
      ...dup,
      ids: dup.ids.split(',').map(id => parseInt(id))
    }))

    return c.json({
      duplicates: duplicatesWithParsedIds,
      total_groups: duplicates.length,
      total_duplicates: duplicates.reduce((sum, dup) => sum + dup.count - 1, 0) // -1 because we keep one
    })
  } catch (error) {
    console.error('Error fetching duplicates:', error)
    return c.json({ error: 'Failed to fetch duplicates' }, 500)
  }
})

// API để xóa ảnh trùng lặp (giữ lại ảnh cũ nhất)
app.post('/api/admin/clean-duplicates', async (c) => {
  const { env } = c
  
  try {
    // Get all duplicate groups
    const { results: duplicates } = await env.DB.prepare(`
      SELECT 
        filename,
        TRIM(style) as style,
        COUNT(*) as count,
        GROUP_CONCAT(id || ':' || uploaded_at) as id_dates
      FROM architecture_images 
      WHERE is_active = 1
      GROUP BY filename, TRIM(style)
      HAVING count > 1
    `).all()

    let deletedCount = 0
    const deletedIds = []

    for (const group of duplicates) {
      // Parse id:date pairs and sort by date (oldest first)
      const idDates = group.id_dates.split(',')
        .map(pair => {
          const [id, date] = pair.split(':')
          return { id: parseInt(id), date }
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date))

      // Keep the oldest, delete the rest
      const toDelete = idDates.slice(1) // Skip first (oldest)
      
      for (const item of toDelete) {
        await env.DB.prepare(`
          UPDATE architecture_images 
          SET is_active = 0 
          WHERE id = ?
        `).bind(item.id).run()
        
        deletedIds.push(item.id)
        deletedCount++
      }
    }

    return c.json({
      success: true,
      deleted_count: deletedCount,
      deleted_ids: deletedIds,
      groups_cleaned: duplicates.length
    })
  } catch (error) {
    console.error('Error cleaning duplicates:', error)
    return c.json({ error: 'Failed to clean duplicates' }, 500)
  }
})

// Lấy thông tin chi tiết một ảnh (admin)
app.get('/api/admin/images/:id', async (c) => {
  const { env } = c
  const imageId = c.req.param('id')
  
  try {
    const { results: image } = await env.DB.prepare(`
      SELECT * FROM architecture_images WHERE id = ?
    `).bind(imageId).all()

    if (image.length === 0) {
      return c.json({ error: 'Image not found' }, 404)
    }

    // Lấy thống kê sử dụng
    const { results: usageStats } = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_appearances,
        SUM(CASE WHEN chosen_image_id = ? THEN 1 ELSE 0 END) as times_chosen
      FROM user_responses 
      WHERE chosen_image_id = ? OR image_left_id = ? OR image_right_id = ?
    `).bind(imageId, imageId, imageId, imageId).all()

    return c.json({
      image: image[0],
      stats: {
        total_appearances: usageStats[0]?.total_appearances || 0,
        times_chosen: usageStats[0]?.times_chosen || 0,
        choice_rate: usageStats[0]?.total_appearances > 0 
          ? Math.round((usageStats[0]?.times_chosen / usageStats[0]?.total_appearances) * 100) 
          : 0
      }
    })
  } catch (error) {
    console.error('Error getting image details:', error)
    return c.json({ error: 'Failed to get image details' }, 500)
  }
})

// Bulk actions cho nhiều ảnh (admin)
app.post('/api/admin/images/bulk', async (c) => {
  const { env } = c
  const { action, imageIds } = await c.req.json()
  
  if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
    return c.json({ error: 'No images selected' }, 400)
  }

  const placeholders = imageIds.map(() => '?').join(',')
  
  try {
    let result
    let message = ''

    switch (action) {
      case 'activate':
        result = await env.DB.prepare(`
          UPDATE architecture_images SET is_active = 1 WHERE id IN (${placeholders})
        `).bind(...imageIds).run()
        message = `Activated ${result.changes || imageIds.length} images`
        break

      case 'deactivate':
        result = await env.DB.prepare(`
          UPDATE architecture_images SET is_active = 0 WHERE id IN (${placeholders})
        `).bind(...imageIds).run()
        message = `Deactivated ${result.changes || imageIds.length} images`
        break

      case 'delete':
        // Improved delete logic:
        // 1. Delete inactive images directly
        // 2. For active images with responses, deactivate instead
        // 3. For active images without responses, delete directly
        
        let deletedCount = 0
        let deactivatedCount = 0
        
        for (const imageId of imageIds) {
          // Get image status
          const { results: imageInfo } = await env.DB.prepare(`
            SELECT is_active FROM architecture_images WHERE id = ?
          `).bind(imageId).all()
          
          if (imageInfo.length === 0) continue
          
          const isActive = imageInfo[0].is_active === 1
          
          // Check if image has responses
          const { results: usageCheck } = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM user_responses 
            WHERE chosen_image_id = ? OR image_left_id = ? OR image_right_id = ?
          `).bind(imageId, imageId, imageId).all()
          
          const hasResponses = usageCheck[0]?.count > 0
          
          if (hasResponses && isActive) {
            // Active image with responses: deactivate
            await env.DB.prepare(`
              UPDATE architecture_images SET is_active = 0 WHERE id = ?
            `).bind(imageId).run()
            deactivatedCount++
          } else {
            // Inactive image or no responses: delete
            if (hasResponses) {
              // Clean up responses first to avoid foreign key constraint
              await env.DB.prepare(`
                DELETE FROM user_responses 
                WHERE chosen_image_id = ? OR image_left_id = ? OR image_right_id = ?
              `).bind(imageId, imageId, imageId).run()
            }
            
            const deleteResult = await env.DB.prepare(`
              DELETE FROM architecture_images WHERE id = ?
            `).bind(imageId).run()
            if (deleteResult.changes > 0) deletedCount++
          }
        }
        
        const actions = []
        if (deletedCount > 0) actions.push('deleted ' + deletedCount)
        if (deactivatedCount > 0) actions.push('deactivated ' + deactivatedCount)
        
        message = actions.length > 0 
          ? 'Successfully ' + actions.join(' and ') + ' images'
          : 'No images were processed'
        result = { changes: deletedCount + deactivatedCount }
        break

      default:
        return c.json({ error: 'Invalid action' }, 400)
    }

    return c.json({ 
      success: true, 
      message,
      affected: result?.changes || imageIds.length
    })
  } catch (error) {
    console.error('Error performing bulk action:', error)
    return c.json({ error: 'Failed to perform bulk action' }, 500)
  }
})

// Debug demographics (admin)
app.get('/api/admin/demographics/debug', async (c) => {
  const { env } = c
  
  try {
    const { results: testQuery } = await env.DB.prepare(`
      SELECT COUNT(*) as total_sessions, 
             COUNT(CASE WHEN user_name IS NOT NULL THEN 1 END) as with_names
      FROM survey_sessions
    `).all()
    
    return c.json({
      debug: true,
      testQuery: testQuery || [],
      db_available: !!env.DB
    })
  } catch (error) {
    return c.json({ error: error.message })
  }
})

// API để lấy user profiles (admin)
app.get('/api/admin/user-profiles', async (c) => {
  const { env } = c
  const category = c.req.query('category') || 'all'
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')
  
  try {
    console.log('User profiles API called with category:', category, 'limit:', limit, 'offset:', offset)
    
    // Build WHERE clause for category filtering
    let whereClause = ''
    let params = []
    
    if (category !== 'all') {
      whereClause = 'WHERE survey_category = ?'
      params.push(category)
    }
    
    // Get user profiles with survey completion info
    const { results: profiles } = await env.DB.prepare(`
      SELECT 
        id,
        user_name,
        user_email,
        user_phone,
        user_location,
        user_age_range,
        user_gender,
        survey_category,
        status,
        started_at,
        completed_at,
        total_pairs,
        (
          SELECT sr.dominant_style 
          FROM session_results sr 
          WHERE sr.session_id = survey_sessions.id 
          LIMIT 1
        ) as result_style,
        (
          SELECT sr.confidence_score 
          FROM session_results sr 
          WHERE sr.session_id = survey_sessions.id 
          LIMIT 1
        ) as confidence_score
      FROM survey_sessions
      ${whereClause}
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all()

    // Get total count
    const { results: countResult } = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM survey_sessions ${whereClause}
    `).bind(...params).all()

    console.log('Found user profiles:', profiles?.length || 0)
    
    return c.json({
      profiles: profiles || [],
      total: countResult[0]?.total || 0,
      limit,
      offset,
      category
    })

  } catch (error) {
    console.error('Error getting user profiles:', error)
    return c.json({ error: 'Failed to get user profiles' }, 500)
  }
})

// Get demographics analytics (admin)  
app.get('/api/admin/demographics', async (c) => {
  const { env } = c
  const category = c.req.query('category') // Optional filter by category
  
  try {
    console.log('Demographics API called with category:', category)
    
    // Simple demographics query
    const { results: allDemographics } = await env.DB.prepare(`
      SELECT 
        survey_category,
        user_age_range,
        user_gender, 
        user_location,
        COUNT(*) as session_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
      FROM survey_sessions 
      WHERE user_name IS NOT NULL OR user_email IS NOT NULL
      GROUP BY survey_category, user_age_range, user_gender, user_location
      ORDER BY survey_category, session_count DESC
    `).all()

    console.log('All demographics found:', allDemographics.length)

    // User contacts  
    const { results: allContacts } = await env.DB.prepare(`
      SELECT 
        survey_category,
        user_name,
        user_email,
        user_phone,
        user_location,
        user_age_range,
        user_gender,
        status,
        started_at
      FROM survey_sessions 
      WHERE user_email IS NOT NULL AND user_email != ''
      ORDER BY started_at DESC 
      LIMIT 100
    `).all()

    console.log('All contacts found:', allContacts.length)

    // Filter by category if specified
    let filteredDemographics, filteredContacts
    
    if (category && category !== 'all') {
      filteredDemographics = allDemographics.filter(d => d.survey_category === category)
      filteredContacts = allContacts.filter(c => c.survey_category === category)
      console.log(`Filtered for ${category}:`, filteredDemographics.length, 'demographics,', filteredContacts.length, 'contacts')
    } else {
      filteredDemographics = allDemographics
      filteredContacts = allContacts
    }

    const summary = {
      total_users: (filteredDemographics || []).reduce((sum, d) => sum + (d.session_count || 0), 0),
      completed_surveys: (filteredDemographics || []).reduce((sum, d) => sum + (d.completed_count || 0), 0),
      email_contacts: (filteredContacts || []).length
    }

    console.log('Summary:', summary)

    return c.json({
      category: category || 'all',
      demographics: filteredDemographics || [],
      userContacts: filteredContacts || [],
      summary: summary
    })
  } catch (error) {
    console.error('Error getting demographics:', error)
    return c.json({ error: 'Failed to get demographics data', details: error.message }, 500)
  }
})

// Delete ALL images (admin) - DANGEROUS operation
app.delete('/api/admin/images/all', async (c) => {
  const { env } = c
  
  try {
    console.log('🚨 DELETE ALL images request received')
    
    // First check if any images have responses
    const { results: hasResponses } = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM user_responses
    `).all()
    
    const responseCount = hasResponses[0]?.count || 0
    
    if (responseCount > 0) {
      // If there are responses, only deactivate all images (safer approach)
      const result = await env.DB.prepare(`
        UPDATE architecture_images SET is_active = 0
      `).run()
      
      return c.json({ 
        success: true, 
        message: `Đã deactivate tất cả ${result.changes} ảnh (do có survey responses)`,
        action: 'deactivated',
        affected: result.changes
      })
    } else {
      // No responses, safe to delete all
      const result = await env.DB.prepare(`
        DELETE FROM architecture_images
      `).run()
      
      return c.json({ 
        success: true, 
        message: `Đã xóa hoàn toàn tất cả ${result.changes} ảnh`,
        action: 'deleted',
        affected: result.changes
      })
    }
  } catch (error) {
    console.error('Error deleting all images:', error)
    return c.json({ error: 'Failed to delete all images' }, 500)
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
              KHẢO SÁT PHONG CÁCH KIẾN TRÚC VÀ NỘI THẤT
            </h1>
            <div className="text-sm text-gray-500">
              <i className="fas fa-users"></i>
            </div>
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
                <h2 className="text-2xl font-bold text-gray-800">Hãy khám phá phong cách của bạn</h2>
                <p className="text-gray-600 leading-relaxed">
                  Chọn loại khảo sát để khám phá phong cách yêu thích của bạn. 
                  Mỗi khảo sát gồm 10 lượt chọn để phân tích sở thích của bạn.
                </p>
                
                {/* Survey Type Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <button id="start-architecture-survey" className="bg-blue-600 text-white py-4 px-6 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg">
                    <i className="fas fa-building mb-2 text-2xl block"></i>
                    Khảo Sát Kiến Trúc
                    <div className="text-xs mt-1 opacity-90">Phong cách nhà ở & công trình</div>
                  </button>
                  
                  <button id="start-interior-survey" className="bg-emerald-600 text-white py-4 px-6 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-lg">
                    <i className="fas fa-couch mb-2 text-2xl block"></i>
                    Khảo Sát Nội Thất
                    <div className="text-xs mt-1 opacity-90">Phong cách trang trí nội thất</div>
                  </button>
                </div>
              </div>
            </div>

            {/* Survey Type Confirmation */}
            <div id="survey-type-screen" className="hidden text-center space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
                <div id="survey-type-icon" className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                  <i className="fas fa-building text-indigo-600 text-2xl"></i>
                </div>
                <h2 id="survey-type-title" className="text-2xl font-bold text-gray-800">Khảo Sát Kiến Trúc</h2>
                <p id="survey-type-description" className="text-gray-600 leading-relaxed">
                  Chọn 1 trong 2 hình ảnh kiến trúc mà bạn thích hơn, hoặc bỏ qua nếu không có ảnh nào phù hợp. 
                  Sau 10 lượt chọn, chúng tôi sẽ phân tích phong cách kiến trúc của bạn.
                </p>
                <div className="flex space-x-3">
                  <button id="show-demographics-form" className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-indigo-700 transition-colors">
                    <i className="fas fa-play mr-2"></i>
                    Bắt Đầu
                  </button>
                  <button id="back-to-selection" className="flex-1 bg-gray-500 text-white py-3 px-6 rounded-xl font-medium hover:bg-gray-600 transition-colors">
                    <i className="fas fa-arrow-left mr-2"></i>
                    Quay Lại
                  </button>
                </div>
              </div>
            </div>

            {/* Demographics Form */}
            <div id="demographics-screen" className="hidden space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                    <i className="fas fa-user text-blue-600 text-2xl"></i>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mt-4">Thông Tin Cá Nhân</h2>
                  <p className="text-gray-600 text-sm mt-2">
                    Thông tin giúp chúng tôi phân tích xu hướng và cải thiện dịch vụ. 
                    <br />
                    <span className="text-xs italic">Tất cả thông tin đều không bắt buộc</span>
                  </p>
                </div>

                <form id="demographics-form" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                      <input 
                        type="text" 
                        id="user_name" 
                        placeholder="Nguyễn Văn A..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input 
                        type="email" 
                        id="user_email" 
                        placeholder="name@example.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                      <input 
                        type="tel" 
                        id="user_phone" 
                        placeholder="0901234567"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nơi cư trú</label>
                      <select 
                        id="user_location" 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Chọn thành phố...</option>
                        <option value="Ho Chi Minh City">TP. Hồ Chí Minh</option>
                        <option value="Hanoi">Hà Nội</option>
                        <option value="Da Nang">Đà Nẵng</option>
                        <option value="Can Tho">Cần Thơ</option>
                        <option value="Hai Phong">Hải Phòng</option>
                        <option value="Bien Hoa">Biên Hòa</option>
                        <option value="Hue">Huế</option>
                        <option value="Nha Trang">Nha Trang</option>
                        <option value="Ba Ria">Bà Rịa</option>
                        <option value="Other">Khác</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Độ tuổi</label>
                      <select 
                        id="user_age_range" 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Chọn độ tuổi...</option>
                        <option value="18-25">18-25 tuổi</option>
                        <option value="26-35">26-35 tuổi</option>
                        <option value="36-45">36-45 tuổi</option>
                        <option value="46-55">46-55 tuổi</option>
                        <option value="55+">Trên 55 tuổi</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Giới tính</label>
                      <select 
                        id="user_gender" 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Chọn giới tính...</option>
                        <option value="male">Nam</option>
                        <option value="female">Nữ</option>
                        <option value="other">Khác</option>
                        <option value="prefer_not_to_say">Không muốn tiết lộ</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button type="submit" className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-blue-700 transition-colors">
                      <i className="fas fa-arrow-right mr-2"></i>
                      Tiếp tục khảo sát
                    </button>
                    <button type="button" id="skip-demographics" className="flex-1 bg-gray-500 text-white py-3 px-6 rounded-xl font-medium hover:bg-gray-600 transition-colors">
                      <i className="fas fa-forward mr-2"></i>
                      Bỏ qua
                    </button>
                  </div>
                </form>
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
                
                {/* 2 Image Comparison */}
                <div className="flex">
                  <button id="left-choice" className="flex-1 relative overflow-hidden hover:opacity-90 transition-opacity border-r border-gray-100">
                    <img id="left-image" src="" alt="Lựa chọn A" className="w-full h-64 object-cover"/>
                    <div className="absolute inset-0 flex items-end justify-center pb-4">
                      <span className="bg-black bg-opacity-60 text-white px-3 py-1 rounded-full text-sm font-medium">A</span>
                    </div>
                  </button>
                  
                  <button id="right-choice" className="flex-1 relative overflow-hidden hover:opacity-90 transition-opacity">
                    <img id="right-image" src="" alt="Lựa chọn B" className="w-full h-64 object-cover"/>
                    <div className="absolute inset-0 flex items-end justify-center pb-4">
                      <span className="bg-black bg-opacity-60 text-white px-3 py-1 rounded-full text-sm font-medium">B</span>
                    </div>
                  </button>
                </div>
                
                {/* Skip Button */}
                <div className="p-4 border-t border-gray-100">
                  <button id="skip-choice" className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium transition-colors">
                    <i class="fas fa-times mr-2"></i>
                    Không có ảnh nào phù hợp
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

// Secure Admin Interface - Hidden endpoint  
app.get('/secure-admin-panel-2024', (c) => {
  // Simple password check via query parameter
  const authKey = c.req.query('key')
  const expectedKey = 'arch-survey-admin-2024' // Simple auth key
  
  if (!authKey || authKey !== expectedKey) {
    return c.html(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Access Denied</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 flex items-center justify-center min-h-screen">
        <div class="bg-white p-8 rounded-lg shadow-lg text-center">
          <i class="fas fa-lock text-4xl text-red-500 mb-4"></i>
          <h1 class="text-2xl font-bold text-gray-800 mb-2">Truy cập bị từ chối</h1>
          <p class="text-gray-600">Bạn không có quyền truy cập vào khu vực này.</p>
          <a href="/" class="mt-4 inline-block bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors">
            Về trang chủ
          </a>
        </div>
      </body>
      </html>
    `, 403)
  }
  return c.render(
    <div>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <i className="fas fa-shield-alt mr-2 text-red-600"></i>
              <h1 className="text-2xl font-bold text-gray-800">
                Secure Admin Panel
              </h1>
              <span className="ml-3 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                Restricted Access
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                <i className="fas fa-user-shield mr-1"></i>
                Administrator
              </span>
              <a href="/" className="text-indigo-600 hover:text-indigo-800 font-medium">
                <i className="fas fa-home mr-1"></i>
                Survey Home
              </a>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-users text-blue-600 text-xl"></i>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Khảo sát hoàn thành</p>
                  <p id="total-sessions" className="text-2xl font-bold text-gray-900">0</p>
                  <div id="sessions-breakdown" className="text-xs text-gray-500 mt-1">
                    {/* Category breakdown will be populated here */}
                  </div>
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
                  <div id="images-breakdown" className="text-xs text-gray-500 mt-1">
                    {/* Category breakdown will be populated here */}
                  </div>
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

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-address-book text-orange-600 text-xl"></i>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Thông tin liên hệ</p>
                  <p id="total-contacts" className="text-2xl font-bold text-gray-900">0</p>
                  <p className="text-xs text-gray-500 mt-1">Email thu thập được</p>
                </div>
              </div>
            </div>
          </div>

          {/* Demographics Analytics */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">
                <i className="fas fa-chart-pie mr-2 text-indigo-600"></i>
                Phân Tích Nhân Khẩu Học
              </h2>
              <div className="flex space-x-2">
                <button id="demographics-architecture-btn" className="demographics-filter-btn px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <i className="fas fa-building mr-1"></i>
                  Kiến Trúc
                </button>
                <button id="demographics-interior-btn" className="demographics-filter-btn px-3 py-1 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                  <i className="fas fa-couch mr-1"></i>
                  Nội Thất
                </button>
                <button id="demographics-all-btn" className="demographics-filter-btn px-3 py-1 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                  <i className="fas fa-globe mr-1"></i>
                  Tất Cả
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-4">
                  <i className="fas fa-users mr-2"></i>
                  Phân Bố Theo Độ Tuổi & Giới Tính
                </h3>
                <div id="demographics-chart" className="space-y-3">
                  {/* Demographics chart will be populated here */}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-4">
                  <i className="fas fa-map-marker-alt mr-2"></i>
                  Phân Bố Theo Khu Vực
                </h3>
                <div id="location-chart" className="space-y-3">
                  {/* Location chart will be populated here */}
                </div>
              </div>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="bg-white rounded-xl shadow-sm mb-8">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                <button id="tab-architecture" className="category-tab py-4 px-1 border-b-2 border-blue-500 font-medium text-sm text-blue-600">
                  <i className="fas fa-building mr-2"></i>
                  Kiến Trúc
                </button>
                <button id="tab-interior" className="category-tab py-4 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300">
                  <i className="fas fa-couch mr-2"></i>
                  Nội Thất
                </button>
              </nav>
            </div>
            

          </div>

          {/* User Profiles Section */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">
                <i className="fas fa-address-book mr-2 text-purple-600"></i>
                Hồ Sơ Người Khảo Sát
              </h2>
              <div className="flex items-center space-x-4">
                <div className="flex space-x-2">
                  <button id="profiles-architecture-btn" className="profiles-filter-btn px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <i className="fas fa-building mr-1"></i>
                    Kiến Trúc
                  </button>
                  <button id="profiles-interior-btn" className="profiles-filter-btn px-3 py-1 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                    <i className="fas fa-couch mr-1"></i>
                    Nội Thất
                  </button>
                  <button id="profiles-all-btn" className="profiles-filter-btn px-3 py-1 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                    <i className="fas fa-globe mr-1"></i>
                    Tất Cả
                  </button>
                </div>
                <button id="refresh-profiles-btn" className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  <i className="fas fa-sync-alt mr-1"></i>
                  Làm mới
                </button>
              </div>
            </div>
            
            <div id="user-profiles-container" className="space-y-4">
              {/* User profiles will be populated here */}
              <div className="text-center py-8 text-gray-500">
                <i className="fas fa-spinner fa-spin text-2xl mb-2"></i>
                <p>Đang tải hồ sơ...</p>
              </div>
            </div>
            
            <div id="profiles-pagination" className="hidden flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Hiển thị <span id="profiles-range-start">1</span>-<span id="profiles-range-end">10</span> 
                trong tổng số <span id="profiles-total-count">0</span> hồ sơ
              </div>
              <div className="flex space-x-2">
                <button id="profiles-prev-btn" className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50" disabled>
                  <i className="fas fa-chevron-left mr-1"></i>
                  Trước
                </button>
                <button id="profiles-next-btn" className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50" disabled>
                  Sau
                  <i className="fas fa-chevron-right ml-1"></i>
                </button>
              </div>
            </div>
          </div>

          {/* Upload Section */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              <i className="fas fa-upload mr-2 text-indigo-600"></i>
              Upload Ảnh Mới - <span id="upload-category-label">Kiến Trúc</span>
            </h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <form id="upload-form" enctype="multipart/form-data">
                <input type="hidden" id="upload-category" value="architecture"/>
                <input type="file" id="image-input" accept="image/*" multiple className="hidden"/>
                <label htmlFor="image-input" className="cursor-pointer block">
                  <div className="mb-4">
                    <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4 block"></i>
                    <p className="text-lg font-medium text-gray-700">Chọn ảnh để upload</p>
                    <p id="upload-hint" className="text-sm text-gray-500">Tên file sẽ quyết định phong cách kiến trúc (vd: modern_house_01.jpg)</p>
                  </div>
                </label>
                <div className="flex gap-4 justify-center mt-4">
                  <button type="submit" className="bg-indigo-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                    <i className="fas fa-upload mr-2"></i>
                    Upload
                  </button>
                  <button type="button" id="test-upload-btn" className="bg-green-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors">
                    <i className="fas fa-flask mr-2"></i>
                    Test Upload
                  </button>
                </div>
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

          {/* Duplicate Management */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">
                <i className="fas fa-copy mr-2 text-red-600"></i>
                Quản Lý Ảnh Trùng Lặp
              </h2>
              <div className="flex gap-2">
                <button id="scan-content-duplicates-btn" className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
                  <i className="fas fa-fingerprint mr-1"></i>
                  Quét Nội Dung
                </button>
                <button id="scan-duplicates-btn" className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                  <i className="fas fa-search mr-1"></i>
                  Quét Tên File
                </button>
                <button id="clean-content-duplicates-btn" className="text-sm bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors">
                  <i className="fas fa-broom mr-1"></i>
                  Dọn Nội Dung
                </button>
                <button id="clean-duplicates-btn" className="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
                  <i className="fas fa-trash mr-1"></i>
                  Dọn Tên File
                </button>
              </div>
            </div>

            {/* Duplicates Summary */}
            <div id="duplicates-summary" className="hidden">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-center">
                  <i className="fas fa-exclamation-triangle text-yellow-600 mr-2"></i>
                  <span className="font-medium">Phát hiện <span id="duplicate-groups-count">0</span> nhóm ảnh trùng lặp với tổng <span id="total-duplicates-count">0</span> ảnh cần xóa</span>
                </div>
              </div>
            </div>

            {/* Duplicates List */}
            <div id="duplicates-container" className="space-y-4">
              <div className="text-center text-gray-500 py-8">
                <i className="fas fa-search text-4xl mb-4 block"></i>
                <p>Click "Quét Trùng Lặp" để tìm ảnh trùng lặp</p>
              </div>
            </div>
          </div>

          {/* Advanced Image Gallery */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="flex items-center justify-between p-6 pb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                <i className="fas fa-images mr-2 text-indigo-600"></i>
                Quản Lý Thư Viện Ảnh
              </h2>
              <button id="toggle-gallery-view" className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors">
                <i className="fas fa-th mr-1"></i>
                Grid View
              </button>
            </div>

            {/* Category Tabs */}
            <div className="px-6">
              <nav className="flex space-x-8 border-b border-gray-200">
                <button id="gallery-tab-architecture" className="category-tab py-4 px-1 border-b-2 border-indigo-500 font-medium text-sm text-indigo-600">
                  <i className="fas fa-building mr-2"></i>
                  Kiến Trúc
                </button>
                <button id="gallery-tab-interior" className="category-tab py-4 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300">
                  <i className="fas fa-couch mr-2"></i>
                  Nội Thất
                </button>
              </nav>
            </div>
            
            {/* Category Management Bar */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-gray-700">
                    Quản lý ảnh: <span id="current-category-label" className="capitalize font-semibold text-indigo-600">Kiến Trúc</span>
                  </span>
                  <span id="category-image-count" className="text-sm text-gray-500">0 ảnh</span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button id="debug-category-btn" className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                    <i className="fas fa-bug mr-1"></i>
                    Debug
                  </button>
                  <button id="refresh-category-btn" className="px-3 py-1 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                    <i className="fas fa-sync-alt mr-1"></i>
                    Làm mới
                  </button>
                  <button id="delete-category-all-btn" className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors border-2 border-red-500">
                    <i className="fas fa-exclamation-triangle mr-1"></i>
                    Xóa tất cả <span id="delete-category-name">Kiến Trúc</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">

              {/* Search and Filter Bar */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tìm kiếm</label>
                  <input 
                    type="text" 
                    id="search-input" 
                    placeholder="Tên file hoặc ảnh..." 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phong cách</label>
                  <select id="style-filter" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    <option value="all">Tất cả</option>
                    {/* Architecture styles */}
                    <optgroup id="architecture-styles" label="Kiến trúc">
                      <option value="modern">Modern</option>
                      <option value="classical">Classical</option>
                      <option value="traditional">Traditional</option>
                      <option value="contemporary">Contemporary</option>
                      <option value="minimalist">Minimalist</option>
                      <option value="industrial">Industrial</option>
                      <option value="art deco">Art Deco</option>
                      <option value="mediterranean">Mediterranean</option>
                      <option value="craftsman">Craftsman</option>
                      <option value="bauhaus">Bauhaus</option>
                      <option value="neoclassic">Neoclassic</option>
                      <option value="colonial">Colonial</option>
                      <option value="italian">Italian</option>
                      <option value="brutalist">Brutalist</option>
                      <option value="gothic">Gothic</option>
                      <option value="prairie">Prairie</option>
                      <option value="spanish colonial">Spanish Colonial</option>
                      <option value="tudor">Tudor</option>
                    </optgroup>
                    {/* Interior styles */}
                    <optgroup id="interior-styles" label="Nội thất" style="display: none;">
                      <option value="modern">Modern</option>
                      <option value="traditional">Traditional</option>
                      <option value="contemporary">Contemporary</option>
                      <option value="minimalist">Minimalist</option>
                      <option value="industrial">Industrial</option>
                      <option value="art deco">Art Deco</option>
                      <option value="mediterranean">Mediterranean</option>
                      <option value="bohemian">Bohemian</option>
                      <option value="scandinavian">Scandinavian</option>
                      <option value="rustic">Rustic</option>
                      <option value="mid century">Mid Century</option>
                      <option value="eclectic">Eclectic</option>
                      <option value="transitional">Transitional</option>
                      <option value="farmhouse">Farmhouse</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                  <select id="status-filter" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    <option value="all">Tất cả</option>
                    <option value="active">Đang hoạt động</option>
                    <option value="inactive">Đã tắt</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button id="search-btn" className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                    <i className="fas fa-search mr-2"></i>
                    Lọc
                  </button>
                </div>
              </div>
            </div>

              {/* Bulk Actions Bar */}
              <div id="bulk-actions" className="hidden bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <span id="selected-count" className="text-sm text-blue-700 font-medium">0 ảnh được chọn</span>
                <div className="flex space-x-2">
                  <button id="bulk-activate" className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors">
                    <i className="fas fa-eye mr-1"></i>
                    Kích hoạt
                  </button>
                  <button id="bulk-deactivate" className="text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 transition-colors">
                    <i className="fas fa-eye-slash mr-1"></i>
                    Tắt
                  </button>
                  <button id="bulk-delete" className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors">
                    <i className="fas fa-trash mr-1"></i>
                    Xóa
                  </button>
                  <button id="clear-selection" className="text-sm bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 transition-colors">
                    Bỏ chọn
                  </button>
                  <button id="delete-all" className="text-sm bg-red-800 text-white px-3 py-1 rounded hover:bg-red-900 transition-colors border-2 border-red-600">
                    <i className="fas fa-exclamation-triangle mr-1"></i>
                    Xóa tất cả
                  </button>
                </div>
              </div>
            </div>

              {/* Image Grid */}
              <div id="image-gallery" className="grid grid-cols-4 gap-4">
              {/* Grid layout 4x4 columns - Images will be populated by JavaScript */}
            </div>

              {/* Load More Button */}
              <div id="load-more-container" className="text-center mt-6 hidden">
              <button id="load-more-btn" className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                <i className="fas fa-plus mr-2"></i>
                Tải thêm ảnh
              </button>
            </div>

              {/* Empty State */}
              <div id="empty-state" className="hidden text-center py-12">
              <i className="fas fa-images text-gray-300 text-6xl mb-4"></i>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Không có ảnh nào</h3>
                <p className="text-gray-500">Upload ảnh đầu tiên để bắt đầu bộ sưu tập.</p>
              </div>
            </div>
          </div>

          {/* Image Edit Modal */}
          <div id="edit-modal" className="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Chỉnh sửa ảnh</h3>
                <button id="close-modal" className="text-gray-400 hover:text-gray-600">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
              <form id="edit-form">
                <input type="hidden" id="edit-image-id" />
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên file</label>
                    <input type="text" id="edit-filename" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phong cách</label>
                    <select id="edit-style" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                      <option value="modern">Modern</option>
                      <option value="classical">Classical</option>
                      <option value="industrial">Industrial</option>
                      <option value="traditional">Traditional</option>
                      <option value="minimalist">Minimalist</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên gốc</label>
                    <input type="text" id="edit-original-name" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="edit-is-active" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <label className="ml-2 text-sm text-gray-700">Đang hoạt động</label>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button type="button" id="cancel-edit" className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors">
                    Lưu thay đổi
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Image Details Modal */}
          <div id="details-modal" className="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Chi tiết ảnh</h3>
                <button id="close-details-modal" className="text-gray-400 hover:text-gray-600">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
              <div id="image-details-content">
                {/* Details will be populated by JavaScript */}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
})

// Admin panel route - direct access to admin interface
app.get('/admin', (c) => {
  // Direct access to admin panel - no auth required for development
  return c.render(
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-800">
              <i className="fas fa-cogs mr-2 text-indigo-600"></i>
              Admin Panel
            </h1>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm rounded-full">
              Gallery Management
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <a href="/" className="text-gray-600 hover:text-indigo-600 transition-colors">
              <i className="fas fa-home mr-1"></i>
              Về trang chủ
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <i className="fas fa-users text-2xl"></i>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Khảo sát hoàn thành</p>
                <p id="total-sessions" className="text-2xl font-bold text-gray-900">0</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <i className="fas fa-images text-2xl"></i>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Tổng số ảnh hoạt động</p>
                <p id="total-images" className="text-2xl font-bold text-gray-900">0</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <i className="fas fa-star text-2xl"></i>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Phong cách phổ biến</p>
                <p id="popular-style" className="text-2xl font-bold text-gray-900 capitalize">-</p>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow mb-8 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            <i className="fas fa-upload mr-2 text-indigo-600"></i>
            Upload Ảnh Mới
          </h2>
          
          <form id="upload-form" className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label htmlFor="image-input" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
                  <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Nhấp để upload</span> hoặc kéo thả</p>
                  <p className="text-xs text-gray-500">PNG, JPG, WEBP (MAX. 10MB)</p>
                </div>
                <input id="image-input" type="file" className="hidden" multiple accept="image/*" />
              </label>
            </div>
            
            <div className="flex space-x-4">
              <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                <i className="fas fa-upload mr-2"></i>
                Upload Ảnh
              </button>
              <button type="button" id="test-upload-btn" className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                <i className="fas fa-vial mr-2"></i>
                Test Upload
              </button>
            </div>
          </form>
        </div>

        {/* Category Tabs */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="border-b border-gray-200">
            <div className="px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                <i className="fas fa-images mr-2 text-indigo-600"></i>
                Quản Lý Thư Viện Ảnh
              </h2>
              
              {/* Main Category Tabs */}
              <div className="flex space-x-1 mb-4">
                <button id="tab-architecture" className="px-4 py-2 text-sm font-medium text-blue-600 bg-white border-b-2 border-blue-500 hover:text-blue-800 transition-colors">
                  <i className="fas fa-building mr-1"></i>
                  Kiến Trúc
                </button>
                <button id="tab-interior" className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300 transition-colors">
                  <i className="fas fa-couch mr-1"></i>
                  Nội Thất
                </button>
              </div>

              {/* Gallery Sub-tabs */}
              <div className="flex space-x-1">
                <button id="gallery-tab-architecture" className="px-3 py-1 text-xs font-medium text-indigo-600 bg-white border-b-2 border-indigo-500 hover:text-indigo-800 transition-colors">
                  Gallery Kiến Trúc
                </button>
                <button id="gallery-tab-interior" className="px-3 py-1 text-xs font-medium text-gray-500 bg-white border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300 transition-colors">
                  Gallery Nội Thất
                </button>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input id="search-input" type="text" placeholder="Tìm kiếm theo tên file..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div className="flex gap-2">
                <select id="style-filter" className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                  <option value="all">Tất cả phong cách</option>
                  {/* Architecture styles */}
                  <optgroup label="Kiến trúc">
                    <option value="art deco ">Art Deco</option>
                    <option value="art nouveau ">Art Nouveau</option>
                    <option value="bauhaus ">Bauhaus</option>
                    <option value="brutalist ">Brutalist</option>
                    <option value="colonial ">Colonial</option>
                    <option value="craftsman ">Craftsman</option>
                    <option value="georgian colonial ">Georgian Colonial</option>
                    <option value="gothic">Gothic Revival</option>
                    <option value="italian ">Italian</option>
                    <option value="mediterranean ">Mediterranean</option>
                    <option value="mid-century-modern ">Mid-Century Modern</option>
                    <option value="minimalist ">Minimalist</option>
                    <option value="modern ">Modern</option>
                    <option value="neoclassic ">Neoclassic</option>
                    <option value="prairie ">Prairie</option>
                    <option value="santorini ">Santorini</option>
                    <option value="shingle ">Shingle</option>
                    <option value="spanish colonial ">Spanish Colonial</option>
                    <option value="tudor ">Tudor</option>
                    <option value="victorian ">Victorian</option>
                  </optgroup>
                  {/* Interior styles */}
                  <optgroup label="Nội thất">
                    <option value="art-nouveau ">Art-Nouveau</option>
                    <option value="art deco ">Art Deco</option>
                    <option value="boho ">Boho</option>
                    <option value="classic ">Classic</option>
                    <option value="contemporary ">Contemporary</option>
                    <option value="eclectic ">Eclectic</option>
                    <option value="industrial ">Industrial</option>
                    <option value="indochine ">Indochine</option>
                    <option value="japandi ">Japandi</option>
                    <option value="mediterranean ">Mediterranean</option>
                    <option value="minimalism ">Minimalism</option>
                    <option value="modern ">Modern</option>
                    <option value="modern-farmhouse ">Modern Farmhouse</option>
                    <option value="neoclassic ">Neoclassic</option>
                    <option value="retro ">Retro</option>
                    <option value="rustic ">Rustic</option>
                    <option value="scandinavian ">Scandinavian</option>
                    <option value="traditional ">Traditional</option>
                    <option value="transitional ">Transitional</option>
                  </optgroup>
                </select>
                <select id="status-filter" className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                  <option value="all">Tất cả trạng thái</option>
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Đã tắt</option>
                </select>
                <button id="search-btn" className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  <i className="fas fa-search"></i>
                </button>
              </div>
            </div>
          </div>

          {/* Duplicate Management */}
          <div className="p-6 border-b border-gray-200 bg-amber-50">
            <h3 className="text-lg font-semibold text-amber-800 mb-4">
              <i className="fas fa-copy mr-2"></i>
              Quản Lý Ảnh Trùng Lặp
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button id="scan-filename-duplicates" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                <i className="fas fa-search mr-2"></i>
                Quét Tên File
              </button>
              <button id="clean-filename-duplicates" className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm">
                <i className="fas fa-trash mr-2"></i>
                Dọn Tên File
              </button>
              <button id="scan-content-duplicates" className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm">
                <i className="fas fa-images mr-2"></i>
                Quét Nội Dung
              </button>
              <button id="clean-content-duplicates" className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors text-sm">
                <i className="fas fa-fire mr-2"></i>
                Dọn Nội Dung
              </button>
            </div>
          </div>

          {/* Bulk Actions */}
          <div id="bulk-actions" className="hidden p-6 border-b border-gray-200 bg-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span id="selected-count" className="text-sm font-medium text-blue-800">0 ảnh được chọn</span>
                <div className="flex space-x-2">
                  <button id="bulk-activate" className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors">
                    <i className="fas fa-eye mr-1"></i>
                    Kích hoạt
                  </button>
                  <button id="bulk-deactivate" className="px-3 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700 transition-colors">
                    <i className="fas fa-eye-slash mr-1"></i>
                    Tắt
                  </button>
                  <button id="bulk-delete" className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors">
                    <i className="fas fa-trash mr-1"></i>
                    Xóa
                  </button>
                </div>
              </div>
              <div className="flex space-x-2">
                <button id="clear-selection" className="px-3 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 transition-colors">
                  Bỏ chọn tất cả
                </button>
                <button id="delete-all" className="px-3 py-1 bg-red-800 text-white rounded text-xs hover:bg-red-900 transition-colors">
                  <i className="fas fa-bomb mr-1"></i>
                  XÓA TẤT CẢ
                </button>
              </div>
            </div>
          </div>

          {/* Image Gallery */}
          <div className="p-6">
            <div id="image-gallery" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {/* Images will be loaded here by JavaScript */}
            </div>
            
            {/* Empty State */}
            <div id="empty-state" className="hidden text-center py-12">
              <i className="fas fa-images text-4xl text-gray-400 mb-4"></i>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có ảnh nào</h3>
              <p className="text-gray-500">Upload ảnh đầu tiên để bắt đầu</p>
            </div>
            
            {/* Load More */}
            <div id="load-more-container" className="hidden text-center mt-8">
              <button id="load-more-btn" className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                <i className="fas fa-chevron-down mr-2"></i>
                Xem thêm
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      <div id="edit-modal" className="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Chỉnh sửa ảnh</h3>
              <button id="close-modal" className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <form id="edit-form" className="space-y-4">
              <input type="hidden" id="edit-image-id" />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên file</label>
                <input type="text" id="edit-filename" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phong cách</label>
                <select id="edit-style" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                  {/* Architecture styles */}
                  <optgroup label="Kiến trúc">
                    <option value="art deco ">Art Deco</option>
                    <option value="art nouveau ">Art Nouveau</option>
                    <option value="bauhaus ">Bauhaus</option>
                    <option value="brutalist ">Brutalist</option>
                    <option value="colonial ">Colonial</option>
                    <option value="craftsman ">Craftsman</option>
                    <option value="georgian colonial ">Georgian Colonial</option>
                    <option value="gothic">Gothic Revival</option>
                    <option value="italian ">Italian</option>
                    <option value="mediterranean ">Mediterranean</option>
                    <option value="mid-century-modern ">Mid-Century Modern</option>
                    <option value="minimalist ">Minimalist</option>
                    <option value="modern ">Modern</option>
                    <option value="neoclassic ">Neoclassic</option>
                    <option value="prairie ">Prairie</option>
                    <option value="santorini ">Santorini</option>
                    <option value="shingle ">Shingle</option>
                    <option value="spanish colonial ">Spanish Colonial</option>
                    <option value="tudor ">Tudor</option>
                    <option value="victorian ">Victorian</option>
                  </optgroup>
                  {/* Interior styles */}
                  <optgroup label="Nội thất">
                    <option value="art-nouveau ">Art-Nouveau</option>
                    <option value="art deco ">Art Deco</option>
                    <option value="boho ">Boho</option>
                    <option value="classic ">Classic</option>
                    <option value="contemporary ">Contemporary</option>
                    <option value="eclectic ">Eclectic</option>
                    <option value="industrial ">Industrial</option>
                    <option value="indochine ">Indochine</option>
                    <option value="japandi ">Japandi</option>
                    <option value="mediterranean ">Mediterranean</option>
                    <option value="minimalism ">Minimalism</option>
                    <option value="modern ">Modern</option>
                    <option value="modern-farmhouse ">Modern Farmhouse</option>
                    <option value="neoclassic ">Neoclassic</option>
                    <option value="retro ">Retro</option>
                    <option value="rustic ">Rustic</option>
                    <option value="scandinavian ">Scandinavian</option>
                    <option value="traditional ">Traditional</option>
                    <option value="transitional ">Transitional</option>
                  </optgroup>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên gốc</label>
                <input type="text" id="edit-original-name" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
              
              <div className="flex items-center">
                <input type="checkbox" id="edit-is-active" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <label htmlFor="edit-is-active" className="ml-2 text-sm text-gray-700">Hoạt động</label>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors">
                  Lưu thay đổi
                </button>
                <button type="button" id="cancel-edit" className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors">
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      <div id="details-modal" className="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Chi tiết ảnh</h3>
              <button id="close-details-modal" className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div id="image-details-content">
              {/* Content will be loaded by JavaScript */}
            </div>
          </div>
        </div>
      </div>

      {/* JavaScript */}
      <script src="/static/app.js"></script>
    </div>
  )
})

export default app