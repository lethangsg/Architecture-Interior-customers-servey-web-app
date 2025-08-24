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
    
    // Try to get image from R2 storage
    try {
      const object = await env.R2.get(imageData.file_path)
      if (object) {
        return new Response(object.body, {
          headers: {
            'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000'
          }
        })
      }
    } catch (r2Error) {
      console.log('R2 not available or image not found in R2:', r2Error.message)
    }
    
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
    const formData = await c.req.formData()
    const file = formData.get('image') as File
    
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
    
    // Save image metadata to database
    const result = await env.DB.prepare(`
      INSERT INTO architecture_images (filename, style, file_path, original_name)
      VALUES (?, ?, ?, ?)
    `).bind(safeFilename, style, filePath, filename).run()

    return c.json({ 
      success: true, 
      imageId: result.meta.last_row_id,
      filename: safeFilename,
      originalName: filename,
      style,
      filePath,
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
  const search = c.req.query('search') // search in filename
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')
  
  try {
    let whereConditions = []
    let params: any[] = []

    if (style && style !== 'all') {  
      whereConditions.push('style = ?')
      params.push(style)
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
                <label htmlFor="image-input" className="cursor-pointer block">
                  <div className="mb-4">
                    <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4 block"></i>
                    <p className="text-lg font-medium text-gray-700">Chọn ảnh để upload</p>
                    <p className="text-sm text-gray-500">Tên file sẽ quyết định phong cách (vd: modern_house_01.jpg)</p>
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

          {/* Advanced Image Gallery */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">
                <i className="fas fa-images mr-2 text-indigo-600"></i>
                Quản Lý Thư Viện Ảnh
              </h2>
              <button id="toggle-gallery-view" className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors">
                <i className="fas fa-th mr-1"></i>
                Grid View
              </button>
            </div>

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
                    <option value="art deco">Art Deco</option>
                    <option value="bauhaus">Bauhaus</option>
                    <option value="brutalist">Brutalist</option>
                    <option value="classic">Classic</option>
                    <option value="classical">Classical</option>
                    <option value="colonial">Colonial</option>
                    <option value="craftsman">Craftsman</option>
                    <option value="gothic">Gothic</option>
                    <option value="industrial">Industrial</option>
                    <option value="italian">Italian</option>
                    <option value="mediterranean">Mediterranean</option>
                    <option value="minimalist">Minimalist</option>
                    <option value="modern">Modern</option>
                    <option value="neoclassic">Neoclassic</option>
                    <option value="prairie">Prairie</option>
                    <option value="spanish colonial">Spanish Colonial</option>
                    <option value="traditional">Traditional</option>
                    <option value="tudor">Tudor</option>
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
            <div id="image-gallery" className="pinterest-gallery">
              {/* Pinterest-style masonry layout - Images will be populated by JavaScript */}
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
              <p className="text-gray-500">Upload ảnh đầu tiên để bắt đầu xây dựng bộ sưu tập.</p>
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

export default app