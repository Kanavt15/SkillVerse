import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Check, Search as SearchIcon } from 'lucide-react';

const TagFilter = ({ selectedTags = [], onChange, className = '' }) => {
  const [tags, setTags] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/tags?sort=popular&limit=100`);
      const data = await response.json();
      if (data.success) {
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTagToggle = (tagId) => {
    const newSelectedTags = selectedTags.includes(tagId)
      ? selectedTags.filter(id => id !== tagId)
      : [...selectedTags, tagId];
    onChange(newSelectedTags);
  };

  const handleRemoveTag = (tagId, e) => {
    e.stopPropagation();
    onChange(selectedTags.filter(id => id !== tagId));
  };

  const selectedTagObjects = tags.filter(tag => selectedTags.includes(tag.id));

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors min-h-[42px]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex-1 flex items-center gap-1 flex-wrap">
          {selectedTagObjects.length === 0 ? (
            <span className="text-sm text-muted-foreground">Select tags...</span>
          ) : (
            selectedTagObjects.map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-md border border-primary/20"
              >
                {tag.name}
                <button
                  onClick={(e) => handleRemoveTag(tag.id, e)}
                  className="hover:text-primary/70"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-background border border-border rounded-lg shadow-lg max-h-80 overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-60">
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading tags...
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No tags found
              </div>
            ) : (
              <div className="p-2">
                {filteredTags.map(tag => {
                  const isSelected = selectedTags.includes(tag.id);
                  return (
                    <div
                      key={tag.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer hover:bg-accent transition-colors ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTagToggle(tag.id);
                      }}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                          isSelected ? 'bg-primary border-primary' : 'border-border'
                        }`}>
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <span className="text-sm">{tag.name}</span>
                      </div>
                      {tag.course_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {tag.course_count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedTags.length > 0 && (
            <div className="p-2 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selectedTags.length} selected
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                className="text-xs text-primary hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TagFilter;
