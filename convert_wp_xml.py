import xml.etree.ElementTree as ET
import os
import re
from html import unescape

# Paths
XML_PATH = '/mnt/d/AGENTIC_TASK/website/shadowprotocol.WordPress.2026-05-06.xml'
POSTS_DIR = '/mnt/d/AGENTIC_TASK/website/_posts'

# Ensure posts directory exists
os.makedirs(POSTS_DIR, exist_ok=True)

# Namespaces in WordPress XML
NAMESPACES = {
    'content': 'http://purl.org/rss/1.0/modules/content/',
    'wp': 'http://wordpress.org/export/1.2/',
}

def slugify(text):
    """Convert text to a URL-friendly slug."""
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)  # Remove punctuation
    text = re.sub(r'[\s_-]+', '-', text)  # Replace spaces and underscores with hyphen
    text = text.strip('-')
    return text or 'post'

def clean_content(content):
    """Basic cleanup of content (optional)."""
    # Unescape HTML entities
    content = unescape(content)
    # You can add more cleaning if needed (e.g., remove WordPress-specific HTML)
    return content

def main():
    tree = ET.parse(XML_PATH)
    root = tree.getroot()
    channel = root.find('channel')
    
    # Find all items (posts, pages, etc.)
    for item in channel.findall('item'):
        post_type = item.find('wp:post_type', NAMESPACES)
        if post_type is None or post_type.text != 'post':
            # Skip non-post items (like pages, attachments, revisions)
            continue
        
        # Extract data
        title = item.find('title').text if item.find('title') is not None else 'Untitled'
        post_date = item.find('wp:post_date', NAMESPACES)
        post_date_str = post_date.text if post_date is not None else '2026-01-01 00:00:00'
        # Use only the date part for the filename (YYYY-MM-DD)
        date_for_file = post_date_str.split()[0]
        
        content = item.find('content:encoded', NAMESPACES)
        content_text = content.text if content is not None else ''
        content_text = clean_content(content_text)
        
        # Slug: try to use post_name (wp:post_name), else generate from title
        post_name = item.find('wp:post_name', NAMESPACES)
        if post_name is not None and post_name.text:
            slug = post_name.text
        else:
            slug = slugify(title)
        
        # Categories and tags
        categories = []
        tags = []
        for category in item.findall('category'):
            domain = category.get('domain')
            if domain == 'category':
                categories.append(category.text)
            elif domain == 'post_tag':
                tags.append(category.text)
            # If no domain, treat as category (WordPress default)
            elif domain is None:
                categories.append(category.text)
        
        # Build frontmatter
        frontmatter = []
        frontmatter.append('---')
        frontmatter.append(f'layout: post')
        frontmatter.append(f'title: \"{title}\"')
        frontmatter.append(f'date: {post_date_str}')
        frontmatter.append(f'categories: [{", ".join(categories)}]')
        frontmatter.append(f'tags: [{", ".join(tags)}]')
        frontmatter.append(f'slug: {slug}')
        frontmatter.append('---')
        frontmatter.append('')  # Empty line after frontmatter
        
        # Combine frontmatter and content
        markdown_content = '\n'.join(frontmatter) + content_text
        
        # Filename: YYYY-MM-DD-slug.md
        filename = f"{date_for_file}-{slug}.md"
        filepath = os.path.join(POSTS_DIR, filename)
        
        # Write file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        print(f'Created: {filename}')

if __name__ == '__main__':
    main()