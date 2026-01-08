import { uploadVerificationPhoto, submitVerificationRequest } from '../verification';
import { supabase } from '@/lib/supabase';
import { trackApiError } from '@/lib/sentry';

jest.mock('@/lib/supabase');
jest.mock('@/lib/sentry', () => ({
  trackApiError: jest.fn(),
}));

describe('Verification API', () => {
  const mockUser = { id: 'user-123' };
  const mockSupabase = supabase as jest.Mocked<typeof supabase>;
  const mockStorage = {
    upload: jest.fn(),
    createSignedUrl: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    (mockSupabase.storage.from as jest.Mock).mockReturnValue(mockStorage);
  });

  describe('uploadVerificationPhoto', () => {
    it('should return existing URL if already a URL', async () => {
      const existingUrl = 'https://example.com/image.jpg';
      const result = await uploadVerificationPhoto(existingUrl, 'front');
      expect(result).toBe(existingUrl);
      expect(mockStorage.upload).not.toHaveBeenCalled();
    });

    it('should throw error if user not authenticated', async () => {
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        uploadVerificationPhoto('file://test.jpg', 'front')
      ).rejects.toThrow('User not authenticated');
    });

    it('should throw error if file size exceeds limit', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(6 * 1024 * 1024)), // 6MB
        })
      ) as jest.Mock;

      await expect(
        uploadVerificationPhoto('file://test.jpg', 'front')
      ).rejects.toThrow('File size exceeds maximum');
    });

    it('should upload file successfully', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)), // 1KB
        })
      ) as jest.Mock;

      mockStorage.upload.mockResolvedValue({
        data: { path: 'user-123/front-123.jpg' },
        error: null,
      });

      mockStorage.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://signed-url.com/image.jpg' },
        error: null,
      });

      const result = await uploadVerificationPhoto('file://test.jpg', 'front');
      expect(result).toBe('https://signed-url.com/image.jpg');
      expect(mockStorage.upload).toHaveBeenCalled();
      expect(mockStorage.createSignedUrl).toHaveBeenCalled();
    });

    it('should track API error on upload failure', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
        })
      ) as jest.Mock;

      mockStorage.upload.mockResolvedValue({
        data: null,
        error: { message: 'Upload failed' },
      });

      await expect(
        uploadVerificationPhoto('file://test.jpg', 'front')
      ).rejects.toThrow();

      expect(trackApiError).toHaveBeenCalled();
    });
  });

  describe('submitVerificationRequest', () => {
    const mockFrom = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      single: jest.fn(),
    };

    beforeEach(() => {
      (mockSupabase.from as jest.Mock).mockReturnValue(mockFrom);
    });

    it('should return null if user profile does not exist', async () => {
      mockFrom.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const result = await submitVerificationRequest('front-url', 'back-url');
      expect(result).toBeNull();
    });

    it('should create new verification request', async () => {
      mockFrom.maybeSingle.mockResolvedValueOnce({
        data: { id: 'user-123' },
        error: null,
      });

      mockFrom.maybeSingle.mockResolvedValueOnce({
        data: null, // No existing pending request
        error: null,
      });

      mockFrom.single.mockResolvedValue({
        data: {
          id: 'req-123',
          user_id: 'user-123',
          front_photo_url: 'front-url',
          back_photo_url: 'back-url',
          status: 'pending',
        },
        error: null,
      });

      const result = await submitVerificationRequest('front-url', 'back-url');
      expect(result).not.toBeNull();
      expect(result?.status).toBe('pending');
      expect(mockFrom.insert).toHaveBeenCalled();
    });

    it('should update existing pending request', async () => {
      mockFrom.maybeSingle.mockResolvedValueOnce({
        data: { id: 'user-123' },
        error: null,
      });

      mockFrom.maybeSingle.mockResolvedValueOnce({
        data: { id: 'req-123', status: 'pending' },
        error: null,
      });

      mockFrom.single.mockResolvedValue({
        data: {
          id: 'req-123',
          user_id: 'user-123',
          front_photo_url: 'new-front-url',
          back_photo_url: 'new-back-url',
          status: 'pending',
        },
        error: null,
      });

      const result = await submitVerificationRequest('new-front-url', 'new-back-url');
      expect(result).not.toBeNull();
      expect(mockFrom.update).toHaveBeenCalled();
    });
  });
});

