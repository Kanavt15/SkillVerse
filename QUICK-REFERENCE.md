# Advanced Search - Quick Reference

## 🚀 Quick Start

### 1. Run Migration
```bash
mysql -u root -p skillverse < database/migration_advanced_search.sql
```

### 2. Restart Backend
```bash
cd backend
npm start
```

### 3. Test in Browser
Navigate to: `http://localhost:3000/courses`
Click "Advanced Filters" to see new features

## 📡 API Quick Reference

### Tags

```bash
# Get all tags
GET /api/tags

# Get popular tags  
GET /api/tags/popular?limit=20

# Search tags
GET /api/tags?search=javascript

# Get course tags
GET /api/tags/course/:courseId

# Create tag (auth required)
POST /api/tags
Body: { "name": "GraphQL", "description": "..." }

# Update tag (auth required)
PUT /api/tags/:id
Body: { "name": "Updated Name" }

# Delete tag (auth required)
DELETE /api/tags/:id

# Add tag to course (auth required)
POST /api/tags/course/:courseId
Body: { "tag_id": 5 }

# Update course tags (auth required)
PUT /api/tags/course/:courseId
Body: { "tag_ids": [1, 5, 10] }

# Remove tag from course (auth required)
DELETE /api/tags/course/:courseId/:tagId
```

### Course Search

```bash
# Basic search
GET /api/courses?search=javascript

# Tag filter (OR)
GET /api/courses?tags=1,5,10&tag_logic=or

# Tag filter (AND)
GET /api/courses?tags=1,5,10&tag_logic=and

# Rating filter
GET /api/courses?min_rating=4.0

# Price filter
GET /api/courses?max_price=500

# Duration filter
GET /api/courses?min_duration=5&max_duration=20

# Combined filters
GET /api/courses?search=python&tags=1,5&min_rating=4.0&max_price=1000&sort_by=rating
```

## 🎨 Frontend Components

### TagFilter Component
```jsx
import TagFilter from '../components/TagFilter';

<TagFilter
  selectedTags={[1, 5, 10]}
  onChange={(tags) => setSelectedTags(tags)}
/>
```

### Filter State
```javascript
const [filters, setFilters] = useState({
  search: '',
  category_id: '',
  difficulty_level: '',
  tags: [],
  tag_logic: 'or',
  min_rating: '',
  max_price: '',
  min_duration: '',
  max_duration: '',
  sort_by: 'newest',
  page: 1,
  limit: 12
});
```

## 🗃️ Database

### Tables
- `course_tags` - Tag definitions
- `course_tag_relations` - Course-tag links
- `course_tags_view` - Helper view

### Indexes
- `idx_fulltext_search` - Title + description FULLTEXT
- `idx_fulltext_title` - Title-only FULLTEXT
- `idx_published_category_difficulty` - Common filters
- `idx_rating_review_count` - Rating sort
- `idx_published_rating` - Rating filter
- `idx_published_price` - Price filter
- `idx_published_duration` - Duration filter

### Useful Queries

```sql
-- Check FULLTEXT indexes
SHOW INDEX FROM courses WHERE Index_type = 'FULLTEXT';

-- Count tags
SELECT COUNT(*) FROM course_tags;

-- Popular tags
SELECT ct.*, COUNT(ctr.course_id) as course_count
FROM course_tags ct
LEFT JOIN course_tag_relations ctr ON ct.id = ctr.tag_id
GROUP BY ct.id
ORDER BY course_count DESC
LIMIT 20;

-- Course with tags
SELECT c.title, GROUP_CONCAT(ct.name) as tags
FROM courses c
LEFT JOIN course_tag_relations ctr ON c.id = ctr.course_id
LEFT JOIN course_tags ct ON ctr.tag_id = ct.id
WHERE c.id = 1
GROUP BY c.id;

-- Test FULLTEXT search
SELECT title, MATCH(title, description) AGAINST ('javascript' IN NATURAL LANGUAGE MODE) as score
FROM courses
WHERE MATCH(title, description) AGAINST ('javascript' IN NATURAL LANGUAGE MODE)
ORDER BY score DESC
LIMIT 10;
```

## 🧪 Testing

### Quick Tests

```bash
# Test tags API
curl http://localhost:5000/api/tags/popular

# Test FULLTEXT search
curl "http://localhost:5000/api/courses?search=javascript"

# Test tag filter
curl "http://localhost:5000/api/courses?tags=1,5,10"

# Test combined
curl "http://localhost:5000/api/courses?search=python&tags=1&min_rating=4&sort_by=rating"
```

### Frontend Test
1. Go to http://localhost:3000/courses
2. Click "Advanced Filters"
3. Select tags from dropdown
4. Set rating/price/duration
5. Toggle between "Any" and "All" for tags
6. Verify results update
7. Click "Clear all filters"

## 📋 Common Tasks

### Add Tag to Course
```javascript
// Backend (in course creation/update)
const tagIds = [1, 5, 10, 15];
const values = tagIds.map(id => [courseId, id]);
await pool.query(
  'INSERT IGNORE INTO course_tag_relations (course_id, tag_id) VALUES ?',
  [values]
);
```

### Get Course with Tags
```javascript
const [courses] = await pool.query(`
  SELECT c.*, 
    GROUP_CONCAT(ct.name) as tag_names,
    GROUP_CONCAT(ct.id) as tag_ids
  FROM courses c
  LEFT JOIN course_tag_relations ctr ON c.id = ctr.course_id
  LEFT JOIN course_tags ct ON ctr.tag_id = ct.id
  WHERE c.id = ?
  GROUP BY c.id
`, [courseId]);
```

### Search with Relevance
```javascript
const [results] = await pool.query(`
  SELECT *, 
    MATCH(title, description) AGAINST (? IN NATURAL LANGUAGE MODE) as relevance
  FROM courses
  WHERE MATCH(title, description) AGAINST (? IN NATURAL LANGUAGE MODE)
  ORDER BY relevance DESC
  LIMIT 12
`, [searchTerm, searchTerm]);
```

## 🔍 Troubleshooting

### FULLTEXT not working
```sql
-- Check minimum word length
SHOW VARIABLES LIKE 'ft_min_word_len';

-- Default is 4, words shorter are ignored
-- To change, add to my.cnf:
-- ft_min_word_len=3
-- Then restart MySQL and rebuild index
```

### Slow queries
```sql
-- Analyze query
EXPLAIN SELECT * FROM courses 
WHERE MATCH(title, description) AGAINST ('javascript' IN NATURAL LANGUAGE MODE);

-- Check index usage
SHOW INDEX FROM courses;

-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.1;
```

### Tags not showing
```javascript
// Make sure to fetch tags in course query
const [courseTags] = await pool.query(`
  SELECT ctr.course_id, ct.*
  FROM course_tag_relations ctr
  INNER JOIN course_tags ct ON ctr.tag_id = ct.id
  WHERE ctr.course_id IN (?)
`, [courseIds]);
```

## 📚 Documentation Files

- `ADVANCED-SEARCH-IMPLEMENTATION.md` - Full implementation details
- `TESTING-GUIDE.md` - Complete testing procedures  
- `PROJECT-COMPLETION-SUMMARY.md` - Project overview
- `database/migration_advanced_search.sql` - Database migration

## ⚡ Performance Tips

1. **Use FULLTEXT for text search** - Faster than LIKE
2. **Filter before joining** - Reduce joined rows
3. **Use covering indexes** - Avoid table lookups
4. **Cache simple queries** - Redis for non-filtered results
5. **Batch tag fetching** - Single query for all course tags
6. **Limit result sets** - Use pagination (max 50 per page)

## 🎯 Best Practices

### Tag Management
- Normalize tag names (lowercase, trimmed)
- Auto-generate slugs
- Track usage counts
- Prevent deletion of tags in use

### Search Queries
- Use FULLTEXT for natural language
- Combine with traditional filters
- Sort by relevance when searching
- Paginate results

### Frontend
- Debounce search input
- Show loading states
- Clear filters option
- Persist filters in URL params

## 🔐 Security Notes

- Tag CRUD requires authentication
- Course-tag operations check ownership
- Input sanitization on all inputs
- SQL injection protection via parameterized queries
- XSS protection on tag names

## 📊 Monitoring

### Key Metrics
- Query execution time
- Cache hit rate
- Popular searches
- Tag usage distribution
- User engagement with filters

### Health Checks
```bash
# API health
curl http://localhost:5000/api/health

# Tag count
curl http://localhost:5000/api/tags | jq '.count'

# Course count
curl http://localhost:5000/api/courses?page=1&limit=1 | jq '.pagination.totalCourses'
```

---

**Quick Links:**
- Backend: `http://localhost:5000/api`
- Frontend: `http://localhost:3000/courses`
- API Docs: See `API-Documentation.md`
