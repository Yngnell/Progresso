const prisma = require('../prisma');
const { sendNewsEmail } = require('../utils/residentEmails');

// GET /api/news — public sees PUBLISHED only; admin sees all.
async function getNews(req, res, next) {
  try {
    const isAdmin = req.user && req.user.role === 'ADMIN';
    const { status, category, featured } = req.query;

    const where = {};
    if (isAdmin) {
      if (status) where.status = status;
    } else {
      where.status = 'PUBLISHED';
    }
    if (category) where.category = category;
    if (featured === 'true') where.isFeatured = true;

    const news = await prisma.news.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      include: { author: { select: { id: true, name: true } } },
    });
    res.json({ news });
  } catch (err) {
    next(err);
  }
}

// GET /api/news/:id — public sees PUBLISHED only; admin sees any.
async function getNewsItem(req, res, next) {
  try {
    const isAdmin = req.user && req.user.role === 'ADMIN';
    const item = await prisma.news.findUnique({
      where: { id: req.params.id },
      include: { author: { select: { id: true, name: true } } },
    });
    if (!item) return res.status(404).json({ message: 'Article not found' });
    if (!isAdmin && item.status !== 'PUBLISHED') {
      return res.status(404).json({ message: 'Article not found' });
    }

    // Increment view count for published articles.
    if (item.status === 'PUBLISHED') {
      item.views += 1;
      await prisma.news.update({ where: { id: item.id }, data: { views: item.views } });
    }

    res.json({ news: item });
  } catch (err) {
    next(err);
  }
}

// POST /api/news — admin
async function createNews(req, res, next) {
  try {
    const { title, category, excerpt, content, coverImageUrl, isFeatured, status } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }
    const finalStatus = status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';

    const item = await prisma.news.create({
      data: {
        title,
        category,
        excerpt,
        content,
        coverImageUrl,
        isFeatured: Boolean(isFeatured),
        status: finalStatus,
        publishedAt: finalStatus === 'PUBLISHED' ? new Date() : null,
        authorId: req.user.id,
      },
    });
    res.status(201).json({ news: item });
    // Residents who opted in are told about a new published article (after the reply, so
    // the admin never waits for the mail server).
    sendNewsEmail(item).catch((err) => console.error('News email failed:', err.message));
  } catch (err) {
    next(err);
  }
}

// PUT /api/news/:id — admin
async function updateNews(req, res, next) {
  try {
    const existing = await prisma.news.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Article not found' });

    const { title, category, excerpt, content, coverImageUrl, isFeatured, status } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (category !== undefined) data.category = category;
    if (excerpt !== undefined) data.excerpt = excerpt;
    if (content !== undefined) data.content = content;
    if (coverImageUrl !== undefined) data.coverImageUrl = coverImageUrl;
    if (isFeatured !== undefined) data.isFeatured = Boolean(isFeatured);
    if (status !== undefined) {
      data.status = status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
      // Stamp publishedAt the first time it goes live.
      if (data.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
        data.publishedAt = new Date();
      }
    }

    const item = await prisma.news.update({ where: { id: req.params.id }, data });
    res.json({ news: item });
    // Only the first time an article goes live is it emailed (sendNewsEmail claims it).
    if (item.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      sendNewsEmail(item).catch((err) => console.error('News email failed:', err.message));
    }
  } catch (err) {
    next(err);
  }
}

// DELETE /api/news/:id — admin
async function deleteNews(req, res, next) {
  try {
    const existing = await prisma.news.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Article not found' });
    await prisma.news.delete({ where: { id: req.params.id } });
    res.json({ message: 'Article deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getNews, getNewsItem, createNews, updateNews, deleteNews };
