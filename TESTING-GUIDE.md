# Advanced Search - Manual Testing Guide

This guide provides manual test cases and API examples for the new advanced search features.

## Prerequisites
1. Database migration has been run: `source database/migration_advanced_search.sql`
2. Backend server is running: `npm start` or `node server.js`
3. You have test courses in the database

## 1. Tag Management Tests

### Test 1.1: Get All Tags
```bash
curl http://localhost:5000/api/tags

# Expected: List of 70+ tags with course_count
# Response should include: id, name, slug, description, course_count
```

### Test 1.2: Get Popular Tags
```bash
curl http://localhost:5000/api/tags/popular?limit=10

# Expected: Top 10 most used tags sorted by course_count DESC
```

### Test 1.3: Search Tags
```bash
curl "http://localhost:5000/api/tags?search=javascript&sort=popular"

# Expected: Tags matching "javascript" (JavaScript, TypeScript, etc.)
```

### Test 1.4: Get Single Tag by ID
```bash
curl http://localhost:5000/api/tags/1

# Expected: Single tag object with course_count
```

### Test 1.5: Get Single Tag by Slug
```bash
curl http://localhost:5000/api/tags/javascript

# Expected: JavaScript tag details
```

### Test 1.6: Create New Tag (requires authentication)
```bash
curl -X POST http://localhost:5000/api/tags \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GraphQL",
    "description": "GraphQL API development"
  }'

# Expected: 201 Created with new tag object
# Note: Slug is auto-generated from name
```

### Test 1.7: Update Tag (requires authentication)
```bash
curl -X PUT http://localhost:5000/api/tags/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "JavaScript ES6+",
    "description": "Modern JavaScript with ES6 and beyond"
  }'

# Expected: 200 OK with updated tag
```

### Test 1.8: Delete Tag - Should Fail if In Use
```bash
# First, add tag to a course (see Test 2.1)
# Then try to delete it
curl -X DELETE http://localhost:5000/api/tags/1 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 400 Bad Request with message about courses using the tag
```

### Test 1.9: Delete Unused Tag
```bash
# Create a new tag that's not used
# Then delete it
curl -X DELETE http://localhost:5000/api/tags/99 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 200 OK with success message
```

## 2. Course-Tag Relationship Tests

### Test 2.1: Add Tag to Course
```bash
curl -X POST http://localhost:5000/api/tags/course/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tag_id": 5}'

# Expected: 200 OK with success message
# Note: Replace course ID (1) and tag_id (5) with actual values
```

### Test 2.2: Get Course Tags
```bash
curl http://localhost:5000/api/tags/course/1

# Expected: Array of tags associated with course ID 1
```

### Test 2.3: Bulk Update Course Tags
```bash
curl -X PUT http://localhost:5000/api/tags/course/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tag_ids": [1, 5, 10, 15]}'

# Expected: 200 OK with updated tags array
# Note: This replaces all existing tags with the new set
```

### Test 2.4: Remove Tag from Course
```bash
curl -X DELETE http://localhost:5000/api/tags/course/1/5 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 200 OK with success message
# Removes tag ID 5 from course ID 1
```

## 3. FULLTEXT Search Tests

### Test 3.1: Basic FULLTEXT Search
```bash
curl "http://localhost:5000/api/courses?search=javascript"

# Expected: Courses with "javascript" in title or description
# Response includes relevance_score field
# Results sorted by relevance_score DESC
```

### Test 3.2: Multi-Word Search
```bash
curl "http://localhost:5000/api/courses?search=react+hooks+tutorial"

# Expected: Courses matching the phrase
# FULLTEXT uses natural language processing
```

### Test 3.3: Search with Pagination
```bash
curl "http://localhost:5000/api/courses?search=web+development&page=1&limit=12"

# Expected: First 12 results
# Pagination object includes totalPages, totalCourses
```

### Test 3.4: Verify Relevance Scoring
```bash
curl "http://localhost:5000/api/courses?search=python" | jq '.courses[] | {title, relevance_score}'

# Expected: Each course shows relevance_score
# Courses with "python" in title should score higher than description-only
```

## 4. Tag Filtering Tests

### Test 4.1: Single Tag Filter
```bash
curl "http://localhost:5000/api/courses?tags=1"

# Expected: All courses with tag ID 1
```

### Test 4.2: Multiple Tags with OR Logic
```bash
curl "http://localhost:5000/api/courses?tags=1,5,10&tag_logic=or"

# Expected: Courses with ANY of the specified tags (tag 1 OR tag 5 OR tag 10)
```

### Test 4.3: Multiple Tags with AND Logic
```bash
curl "http://localhost:5000/api/courses?tags=1,5,10&tag_logic=and"

# Expected: Courses with ALL specified tags (tag 1 AND tag 5 AND tag 10)
```

### Test 4.4: Tags as Comma-Separated String
```bash
curl "http://localhost:5000/api/courses?tags=1,5,10"

# Expected: Works the same as array format
# Default tag_logic is 'or'
```

## 5. Advanced Filter Combination Tests

### Test 5.1: Search + Tags + Rating
```bash
curl "http://localhost:5000/api/courses?search=python&tags=1,5&min_rating=4.0&sort_by=rating"

# Expected: Python courses with tags 1 or 5, rated 4.0+, sorted by rating
```

### Test 5.2: Category + Difficulty + Price
```bash
curl "http://localhost:5000/api/courses?category_id=1&difficulty_level=beginner&max_price=500"

# Expected: Beginner courses in category 1 costing ≤500 points
```

### Test 5.3: Duration Range
```bash
curl "http://localhost:5000/api/courses?min_duration=5&max_duration=20"

# Expected: Courses between 5-20 hours duration
```

### Test 5.4: All Filters Combined
```bash
curl "http://localhost:5000/api/courses?\
search=web+development&\
category_id=1&\
difficulty_level=intermediate&\
tags=1,5,10&\
tag_logic=or&\
min_rating=3.5&\
max_price=1000&\
min_duration=10&\
max_duration=30&\
sort_by=rating&\
page=1&\
limit=12"

# Expected: Complex filtered results matching all criteria
```

## 6. Sorting Tests

### Test 6.1: Sort by Newest
```bash
curl "http://localhost:5000/api/courses?sort_by=newest&limit=10"

# Expected: Latest 10 courses ordered by created_at DESC
```

### Test 6.2: Sort by Rating
```bash
curl "http://localhost:5000/api/courses?sort_by=rating&limit=10"

# Expected: Top 10 highest-rated courses
# Sort: avg_rating DESC, review_count DESC
```

### Test 6.3: Sort by Popularity
```bash
curl "http://localhost:5000/api/courses?sort_by=popular&limit=10"

# Expected: Top 10 most enrolled courses
# Sort: enrollment_count DESC
```

### Test 6.4: Search Results Sorted by Relevance
```bash
curl "http://localhost:5000/api/courses?search=javascript&sort_by=newest"

# Expected: When search is present, results prioritize relevance_score
# Even if sort_by is specified, relevance takes precedence
```

## 7. Pagination Tests

### Test 7.1: First Page
```bash
curl "http://localhost:5000/api/courses?page=1&limit=12"

# Expected: First 12 courses with pagination metadata
```

### Test 7.2: Navigate Pages
```bash
# Get total pages from first request
curl "http://localhost:5000/api/courses?page=1&limit=12" | jq '.pagination.totalPages'

# Then request different pages
curl "http://localhost:5000/api/courses?page=2&limit=12"
curl "http://localhost:5000/api/courses?page=3&limit=12"

# Expected: Different courses on each page
```

### Test 7.3: Custom Page Size
```bash
curl "http://localhost:5000/api/courses?page=1&limit=24"

# Expected: 24 courses per page
# Max limit is 50
```

### Test 7.4: Page Size Validation
```bash
curl "http://localhost:5000/api/courses?page=1&limit=100"

# Expected: Limit capped at 50 (max allowed)
```

## 8. Edge Cases & Error Handling

### Test 8.1: Empty Search
```bash
curl "http://localhost:5000/api/courses?search="

# Expected: Returns all courses (search ignored if empty)
```

### Test 8.2: Invalid Tag ID
```bash
curl "http://localhost:5000/api/courses?tags=99999"

# Expected: No results or empty courses array
```

### Test 8.3: Invalid Tag Logic
```bash
curl "http://localhost:5000/api/courses?tags=1,5&tag_logic=invalid"

# Expected: Falls back to 'or' logic (default)
```

### Test 8.4: Negative Page Number
```bash
curl "http://localhost:5000/api/courses?page=-1"

# Expected: Treated as page 1 (clamped to minimum)
```

### Test 8.5: Out of Range Page
```bash
curl "http://localhost:5000/api/courses?page=9999"

# Expected: Empty results with valid pagination object
```

### Test 8.6: Non-numeric Filters
```bash
curl "http://localhost:5000/api/courses?min_rating=abc&max_price=xyz"

# Expected: Invalid values ignored, query continues with valid filters
```

## 9. Performance Tests

### Test 9.1: Check Query Cache
```bash
# First request (cache miss)
curl -i "http://localhost:5000/api/courses?category_id=1&sort_by=newest&page=1"

# Check X-Cache header: MISS

# Second identical request (cache hit)
curl -i "http://localhost:5000/api/courses?category_id=1&sort_by=newest&page=1"

# Check X-Cache header: HIT
```

### Test 9.2: Complex Query Bypasses Cache
```bash
curl -i "http://localhost:5000/api/courses?search=test&tags=1,5&min_rating=4"

# Check X-Cache header: BYPASS
# Complex queries don't use cache due to high variation
```

### Test 9.3: Check Index Usage (Database)
```sql
-- Run in MySQL console
EXPLAIN SELECT * FROM courses 
WHERE is_published = true 
AND MATCH(title, description) AGAINST ('javascript' IN NATURAL LANGUAGE MODE)
ORDER BY avg_rating DESC
LIMIT 12;

-- Expected: Shows idx_fulltext_search usage
-- type: fulltext
-- key: idx_fulltext_search
```

### Test 9.4: Check Composite Index Usage
```sql
EXPLAIN SELECT * FROM courses 
WHERE is_published = true 
AND category_id = 1 
AND difficulty_level = 'beginner'
LIMIT 12;

-- Expected: Uses idx_published_category_difficulty
-- type: ref
-- key: idx_published_category_difficulty
```

## 10. Frontend Testing

### Test 10.1: Tag Filter Component
1. Navigate to /courses page
2. Click "Advanced Filters"
3. Click on Tag dropdown
4. Search for "javascript"
5. Select multiple tags
6. Verify tags appear as chips
7. Click X on chip to remove tag
8. Click "Clear all" to remove all tags

### Test 10.2: Tag Logic Toggle
1. Select 2+ tags
2. Notice "Match: Any/All" buttons appear
3. Click "All" - should fetch courses with ALL tags
4. Click "Any" - should fetch courses with ANY tag
5. Verify URL parameters change

### Test 10.3: Advanced Filters
1. Open Advanced Filters panel
2. Set minimum rating to 4.0
3. Set max price to 500
4. Set duration range 5-20 hours
5. Verify results update
6. Click "Clear all filters" to reset

### Test 10.4: Course Card Tags
1. View courses list
2. Each card should show up to 3 tags
3. If more than 3 tags, shows "+N more"
4. Tags styled with primary color

## 11. Database Verification

### Test 11.1: Verify Tables Created
```sql
SHOW TABLES LIKE 'course_tag%';

-- Expected: 
-- course_tags
-- course_tag_relations
```

### Test 11.2: Verify Indexes Created
```sql
SHOW INDEX FROM courses WHERE Index_type = 'FULLTEXT';

-- Expected: idx_fulltext_search, idx_fulltext_title
```

### Test 11.3: Verify Initial Tags
```sql
SELECT COUNT(*) as tag_count FROM course_tags;

-- Expected: 70 tags
```

### Test 11.4: Verify View Created
```sql
SELECT * FROM course_tags_view LIMIT 5;

-- Expected: Shows courses with their tags concatenated
```

## Test Checklist

- [ ] All tag API endpoints working
- [ ] Course-tag relationships functioning
- [ ] FULLTEXT search returns relevant results
- [ ] Single tag filter works
- [ ] Multi-tag OR filter works
- [ ] Multi-tag AND filter works
- [ ] Rating filter works
- [ ] Price filter works
- [ ] Duration filters work
- [ ] Combined filters work correctly
- [ ] Sorting by newest works
- [ ] Sorting by rating works
- [ ] Sorting by popularity works
- [ ] Relevance sorting for search works
- [ ] Pagination works correctly
- [ ] Cache HIT for simple queries
- [ ] Cache BYPASS for complex queries
- [ ] Frontend tag component works
- [ ] Advanced filters panel works
- [ ] Course cards display tags
- [ ] All edge cases handled gracefully

## Performance Benchmarks

Run these with a larger dataset (1000+ courses):

```bash
# Benchmark simple query
time curl "http://localhost:5000/api/courses?category_id=1&limit=12"

# Benchmark FULLTEXT search
time curl "http://localhost:5000/api/courses?search=javascript&limit=12"

# Benchmark complex multi-filter
time curl "http://localhost:5000/api/courses?search=web&tags=1,5,10&tag_logic=and&min_rating=4&max_price=1000&limit=12"
```

Target: < 100ms for most queries
