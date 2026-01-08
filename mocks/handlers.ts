import { http, HttpResponse } from 'msw';

export const handlers = [
  // Auth endpoints
  http.post('https://*.supabase.co/auth/v1/token', () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token',
      user: {
        id: 'user-123',
        email: 'test@example.com',
      },
    });
  }),

  // User profile endpoints
  http.get('https://*.supabase.co/rest/v1/users', () => {
    return HttpResponse.json([
      {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'teen',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  }),

  // Task/Gig endpoints
  http.post('https://*.supabase.co/rest/v1/gigs', () => {
    return HttpResponse.json({
      id: 'gig-123',
      title: 'Test Gig',
      description: 'Test Description',
      pay: 50,
      poster_id: 'user-123',
      status: 'open',
      created_at: new Date().toISOString(),
    });
  }),

  http.get('https://*.supabase.co/rest/v1/gigs', () => {
    return HttpResponse.json([
      {
        id: 'gig-123',
        title: 'Test Gig',
        description: 'Test Description',
        pay: 50,
        status: 'open',
      },
    ]);
  }),

  // Verification endpoints
  http.post('https://*.supabase.co/rest/v1/verification_requests', () => {
    return HttpResponse.json({
      id: 'verification-123',
      user_id: 'user-123',
      front_photo_url: 'https://example.com/front.jpg',
      back_photo_url: 'https://example.com/back.jpg',
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  }),
];

