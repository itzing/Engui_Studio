/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { JobCardImageThumbnail } from '@/components/layout/JobCardImageThumbnail';

describe('JobCardImageThumbnail', () => {
  it('falls back to the original result when the lightweight thumbnail fails', () => {
    render(React.createElement(JobCardImageThumbnail, {
      thumbnailUrl: '/generations/job-previews/thumb.webp',
      resultUrl: '/generations/full.png',
      alt: 'Job preview',
    }));

    const img = screen.getByAltText('Job preview') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/generations/job-previews/thumb.webp');

    fireEvent.error(img);

    const fallbackImg = screen.getByAltText('Job preview') as HTMLImageElement;
    expect(fallbackImg.getAttribute('src')).toBe('/generations/full.png');
  });

  it('shows the placeholder when there is no usable preview source', () => {
    render(React.createElement(JobCardImageThumbnail, {
      alt: 'Missing preview',
    }));

    expect(screen.getByTitle('Preview missing')).toBeTruthy();
  });
});
