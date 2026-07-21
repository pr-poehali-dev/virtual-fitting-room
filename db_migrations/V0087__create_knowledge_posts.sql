CREATE TABLE IF NOT EXISTS t_p29007832_virtual_fitting_room.knowledge_posts (
    id SERIAL PRIMARY KEY,
    section VARCHAR(32) NOT NULL DEFAULT 'article',
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(600) NOT NULL UNIQUE,
    cover_url TEXT,
    excerpt TEXT,
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_posts_section ON t_p29007832_virtual_fitting_room.knowledge_posts (section);
CREATE INDEX IF NOT EXISTS idx_knowledge_posts_published ON t_p29007832_virtual_fitting_room.knowledge_posts (published);
CREATE INDEX IF NOT EXISTS idx_knowledge_posts_slug ON t_p29007832_virtual_fitting_room.knowledge_posts (slug);