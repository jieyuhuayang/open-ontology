import React from 'react';

interface SearchHighlightProps {
  text: string;
  query: string;
}

export default function SearchHighlight({ text, query }: SearchHighlightProps) {
  if (!query.trim()) return <>{text}</>;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);

  const queryLower = query.trim().toLowerCase();

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === queryLower ? (
          <mark key={i} style={{ background: '#fff3cd', padding: 0 }}>
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}
