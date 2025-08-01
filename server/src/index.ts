
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  uploadPictureInputSchema,
  createCommentInputSchema,
  createVoteInputSchema,
  createReportInputSchema,
  getPicturesInputSchema,
  getCommentsInputSchema,
  updateReportStatusInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { uploadPicture } from './handlers/upload_picture';
import { getPictures } from './handlers/get_pictures';
import { getPictureById } from './handlers/get_picture_by_id';
import { createComment } from './handlers/create_comment';
import { getComments } from './handlers/get_comments';
import { createVote } from './handlers/create_vote';
import { createReport } from './handlers/create_report';
import { getReports } from './handlers/get_reports';
import { updateReportStatus } from './handlers/update_report_status';
import { getUserByDeviceId } from './handlers/get_user_by_device_id';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),
  
  getUserByDeviceId: publicProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(({ input }) => getUserByDeviceId(input.deviceId)),

  // Picture management
  uploadPicture: publicProcedure
    .input(uploadPictureInputSchema)
    .mutation(({ input }) => uploadPicture(input)),
  
  getPictures: publicProcedure
    .input(getPicturesInputSchema)
    .query(({ input }) => getPictures(input)),
  
  getPictureById: publicProcedure
    .input(z.object({ pictureId: z.number() }))
    .query(({ input }) => getPictureById(input.pictureId)),

  // Comment management
  createComment: publicProcedure
    .input(createCommentInputSchema)
    .mutation(({ input }) => createComment(input)),
  
  getComments: publicProcedure
    .input(getCommentsInputSchema)
    .query(({ input }) => getComments(input)),

  // Voting system
  createVote: publicProcedure
    .input(createVoteInputSchema)
    .mutation(({ input }) => createVote(input)),

  // Reporting system
  createReport: publicProcedure
    .input(createReportInputSchema)
    .mutation(({ input }) => createReport(input)),

  // Admin endpoints
  getReports: publicProcedure
    .query(() => getReports()),
  
  updateReportStatus: publicProcedure
    .input(updateReportStatusInputSchema)
    .mutation(({ input }) => updateReportStatus(input))
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();
