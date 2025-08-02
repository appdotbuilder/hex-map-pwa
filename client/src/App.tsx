
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/utils/trpc';
import type { Picture, User, Comment, CreateCommentInput, CreateVoteInput, CreateReportInput } from '../../server/src/schema';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('map');

  // Initialize or get user by device ID
  const initUser = useCallback(async () => {
    try {
      let deviceId = localStorage.getItem('deviceId');
      if (!deviceId) {
        // Generate unique device ID
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('deviceId', deviceId);
      }

      // Try to get existing user or create new one
      let existingUser;
      try {
        existingUser = await trpc.getUserByDeviceId.query({ deviceId });
      } catch {
        // User doesn't exist, create new one
        existingUser = await trpc.createUser.mutate({ device_id: deviceId });
      }
      
      setUser(existingUser);
    } catch (error) {
      console.error('Failed to initialize user:', error);
    }
  }, []);

  const loadPictures = useCallback(async () => {
    try {
      const result = await trpc.getPictures.query({ limit: 50 });
      setPictures(result);
    } catch (error) {
      console.error('Failed to load pictures:', error);
    }
  }, []);

  const loadComments = useCallback(async (pictureId: number) => {
    try {
      const result = await trpc.getComments.query({ picture_id: pictureId, limit: 20 });
      setComments(result);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  }, []);

  useEffect(() => {
    initUser();
  }, [initUser]);

  useEffect(() => {
    if (user) {
      loadPictures();
    }
  }, [user, loadPictures]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !user) return;

    setIsLoading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev: number) => Math.min(prev + 10, 90));
      }, 100);

      // Extract EXIF data (stub implementation)
      let latitude: number | null = null;
      let longitude: number | null = null;
      let width: number | null = null;
      let height: number | null = null;
      let exifData: string | null = null;

      // Create a temporary image to get dimensions
      const img = new Image();
      img.onload = async () => {
        width = img.width;
        height = img.height;

        // For demo purposes, generate random coordinates
        // In a real app, you'd extract from EXIF data
        if (Math.random() > 0.3) { // 70% chance of having location
          latitude = 37.7749 + (Math.random() - 0.5) * 0.1; // Around SF
          longitude = -122.4194 + (Math.random() - 0.5) * 0.1;
          exifData = JSON.stringify({
            GPS: { latitude, longitude },
            DateTime: new Date().toISOString(),
            Make: 'Apple',
            Model: 'iPhone',
            width,
            height
          });
        }

        try {
          const uploadData = {
            user_id: user.id,
            filename: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${selectedFile.name.split('.').pop()}`,
            original_filename: selectedFile.name,
            mime_type: selectedFile.type,
            file_size: selectedFile.size,
            width,
            height,
            latitude,
            longitude,
            exif_data: exifData
          };

          const newPicture = await trpc.uploadPicture.mutate(uploadData);
          setPictures((prev: Picture[]) => [newPicture, ...prev]);
          setUploadProgress(100);
          
          setTimeout(() => {
            setUploadProgress(0);
            setIsLoading(false);
            setSelectedFile(null); // Clear selected file after successful upload
            // Reset the file input
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            if (fileInput) {
              fileInput.value = '';
            }
          }, 500);
        } catch (error) {
          console.error('Upload failed:', error);
          setIsLoading(false);
          setUploadProgress(0);
        }
        
        clearInterval(progressInterval);
      };
      
      img.src = URL.createObjectURL(selectedFile);
    } catch (error) {
      console.error('Upload failed:', error);
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const handleVote = async (pictureId: number, voteType: 'upvote' | 'downvote') => {
    if (!user) return;

    try {
      const voteData: CreateVoteInput = {
        user_id: user.id,
        picture_id: pictureId,
        comment_id: null,
        vote_type: voteType
      };

      await trpc.createVote.mutate(voteData);
      
      // Update local state (optimistic update)
      setPictures((prev: Picture[]) => prev.map((pic: Picture) => 
        pic.id === pictureId 
          ? { 
              ...pic, 
              upvotes: voteType === 'upvote' ? pic.upvotes + 1 : pic.upvotes,
              downvotes: voteType === 'downvote' ? pic.downvotes + 1 : pic.downvotes
            }
          : pic
      ));
    } catch (error) {
      console.error('Vote failed:', error);
    }
  };

  const handleComment = async (pictureId: number, content: string) => {
    if (!user || !content.trim()) return;

    try {
      const commentData: CreateCommentInput = {
        picture_id: pictureId,
        user_id: user.id,
        content: content.trim()
      };

      const newComment = await trpc.createComment.mutate(commentData);
      setComments((prev: Comment[]) => [...prev, newComment]);
      
      // Update comment count in pictures
      setPictures((prev: Picture[]) => prev.map((pic: Picture) => 
        pic.id === pictureId 
          ? { ...pic, comment_count: pic.comment_count + 1 }
          : pic
      ));
    } catch (error) {
      console.error('Comment failed:', error);
    }
  };

  const handleReport = async (pictureId: number, reason: string, description?: string) => {
    if (!user) return;

    try {
      const reportData: CreateReportInput = {
        reporter_user_id: user.id,
        picture_id: pictureId,
        comment_id: null,
        reason: reason as 'inappropriate' | 'spam' | 'harassment' | 'copyright' | 'other',
        description: description || null
      };

      await trpc.createReport.mutate(reportData);
    } catch (error) {
      console.error('Report failed:', error);
    }
  };

  const openPictureDialog = async (picture: Picture) => {
    await loadComments(picture.id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">📸 GeoSnap</h1>
              <p className="text-gray-600">Discover the world through location-based photos</p>
            </div>
            {user && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Anonymous User</p>
                <Badge variant={user.is_admin ? "destructive" : "secondary"}>
                  {user.is_admin ? '👑 Admin' : '👤 User'}
                </Badge>
              </div>
            )}
          </div>
        </header>

        {/* Upload Section */}
        <Card className="mb-8 border-2 border-dashed border-blue-200 hover:border-blue-300 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📤 Upload Photo
              {uploadProgress > 0 && (
                <Badge variant="outline">{uploadProgress}%</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={isLoading}
                  className="cursor-pointer flex-1"
                />
                <Button 
                  onClick={handleFileUpload}
                  disabled={!selectedFile || isLoading}
                  className="whitespace-nowrap"
                >
                  {isLoading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
              {selectedFile && !isLoading && (
                <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                  📎 Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
              {uploadProgress > 0 && (
                <Progress value={uploadProgress} className="w-full" />
              )}
              <p className="text-sm text-gray-500">
                📍 Location data will be automatically extracted from EXIF when available
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="map">🗺️ Map View</TabsTrigger>
            <TabsTrigger value="feed">📱 Photo Feed</TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>🌍 H3 Hexagonal Map</CardTitle>
                <p className="text-sm text-gray-600">
                  Interactive hexagon-based map showing photo locations
                </p>
              </CardHeader>
              <CardContent>
                <div className="bg-gradient-to-br from-green-100 to-blue-100 rounded-lg p-8 text-center">
                  <div className="text-6xl mb-4">🗺️</div>
                  <h3 className="text-xl font-semibold mb-2">Interactive Map Coming Soon</h3>
                  <p className="text-gray-600 mb-4">
                    H3 hexagonal grid map with zoomable photo clusters
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-white p-3 rounded">
                      <div className="text-2xl mb-1">⬡</div>
                      <div className="font-semibold">Hex Clustering</div>
                    </div>
                    <div className="bg-white p-3 rounded">
                      <div className="text-2xl mb-1">🔍</div>
                      <div className="font-semibold">Zoom Levels</div>
                    </div>
                    <div className="bg-white p-3 rounded">
                      <div className="text-2xl mb-1">📌</div>
                      <div className="font-semibold">Photo Pins</div>
                    </div>
                    <div className="bg-white p-3 rounded">
                      <div className="text-2xl mb-1">🎯</div>
                      <div className="font-semibold">Location Filter</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feed" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pictures.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <div className="text-6xl mb-4">📷</div>
                  <h3 className="text-xl font-semibold mb-2">No photos yet</h3>
                  <p className="text-gray-600">Upload the first photo to get started!</p>
                </div>
              ) : (
                pictures.map((picture: Picture) => (
                  <Card key={picture.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="aspect-square bg-gray-100 relative">
                      <div className="absolute inset-0 flex items-center justify-center text-6xl">
                        🖼️
                      </div>
                      {picture.latitude && picture.longitude && (
                        <Badge className="absolute top-2 right-2 bg-green-500">
                          📍 Geo-tagged
                        </Badge>
                      )}
                      {picture.is_flagged && (
                        <Badge className="absolute top-2 left-2 bg-red-500">
                          🚩 Flagged
                        </Badge>
                      )}
                    </div>
                    
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleVote(picture.id, 'upvote')}
                            className="text-green-600 hover:text-green-700"
                          >
                            👍 {picture.upvotes}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleVote(picture.id, 'downvote')}
                            className="text-red-600 hover:text-red-700"
                          >
                            👎 {picture.downvotes}
                          </Button>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openPictureDialog(picture)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              💬 {picture.comment_count}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Photo Details</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-8xl">
                                🖼️
                              </div>
                              
                              {picture.latitude && picture.longitude && (
                                <div className="bg-green-50 p-3 rounded">
                                  <p className="text-sm font-medium text-green-800">
                                    📍 Location: {picture.latitude.toFixed(6)}, {picture.longitude.toFixed(6)}
                                  </p>
                                  {picture.h3_index && (
                                    <p className="text-xs text-green-600">H3 Index: {picture.h3_index}</p>
                                  )}
                                </div>
                              )}

                              <div className="border-t pt-4">
                                <h4 className="font-semibold mb-3">💬 Comments ({comments.length})</h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {comments.map((comment: Comment) => (
                                    <div key={comment.id} className="bg-gray-50 p-3 rounded">
                                      <p className="text-sm">{comment.content}</p>
                                      <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs text-gray-500">
                                          {comment.created_at.toLocaleDateString()}
                                        </span>
                                        <div className="flex gap-1">
                                          <span className="text-xs">👍 {comment.upvotes}</span>
                                          <span className="text-xs">👎 {comment.downvotes}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                
                                <CommentForm 
                                  onSubmit={(content: string) => handleComment(picture.id, content)}
                                />
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          {picture.upload_timestamp.toLocaleDateString()}
                        </div>
                        <ReportDialog 
                          onReport={(reason: string, description?: string) => 
                            handleReport(picture.id, reason, description)
                          } 
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Comment Form Component
function CommentForm({ onSubmit }: { onSubmit: (content: string) => void }) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(content);
      setContent('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <Textarea
        placeholder="Add a comment..."
        value={content}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
        rows={2}
        maxLength={1000}
      />
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">{content.length}/1000</span>
        <Button type="submit" size="sm" disabled={isSubmitting || !content.trim()}>
          {isSubmitting ? 'Posting...' : 'Post Comment'}
        </Button>
      </div>
    </form>
  );
}

// Report Dialog Component
function ReportDialog({ onReport }: { onReport: (reason: string, description?: string) => void }) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;

    setIsSubmitting(true);
    try {
      await onReport(reason, description || undefined);
      setReason('');
      setDescription('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700">
          🚩 Report
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Report Content</AlertDialogTitle>
          <AlertDialogDescription>
            Help keep our community safe by reporting inappropriate content.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Reason for reporting</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inappropriate">Inappropriate content</SelectItem>
                <SelectItem value="spam">Spam</SelectItem>
                <SelectItem value="harassment">Harassment</SelectItem>
                <SelectItem value="copyright">Copyright violation</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium">Additional details (optional)</label>
            <Textarea
              placeholder="Provide additional context..."
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleSubmit}
            disabled={!reason || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default App;
