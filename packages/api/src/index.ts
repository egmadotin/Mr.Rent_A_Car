import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { router, createCallerFactory } from "./trpc";
import { customerRouter } from "./routers/customer";
import { metaRouter } from "./routers/staff/meta";
import { rentalRouter } from "./routers/staff/rental";
import { vehicleRouter } from "./routers/staff/vehicle";
import { calendarRouter } from "./routers/staff/calendar";
import { reservationRouter } from "./routers/staff/reservation";
import { quoteRouter } from "./routers/staff/quote";
import { customerRouter as staffCustomerRouter } from "./routers/staff/customer";
import { settingsRouter } from "./routers/staff/settings";
import { bookingRouter } from "./routers/staff/booking";
import { paymentGatewayRouter } from "./routers/staff/payment-gateway";
import { templateRouter } from "./routers/staff/template";
import { emailRouter } from "./routers/staff/email";
import { usersRouter } from "./routers/staff/users";
import { setupRouter } from "./routers/staff/setup";
import { vehicleRecordsRouter } from "./routers/staff/vehicle-records";
import { inspectionsRouter } from "./routers/staff/inspections";
import { checklistsRouter } from "./routers/staff/checklists";
import { importsRouter } from "./routers/staff/imports";
import { marketingRouter } from "./routers/staff/marketing";
import { tasksRouter } from "./routers/staff/tasks";
import { reportsRouter } from "./routers/staff/reports";

export const staffRouter = router({
  meta: metaRouter,
  rental: rentalRouter,
  vehicle: vehicleRouter,
  calendar: calendarRouter,
  reservation: reservationRouter,
  quote: quoteRouter,
  customer: staffCustomerRouter,
  settings: settingsRouter,
  booking: bookingRouter,
  paymentGateway: paymentGatewayRouter,
  template: templateRouter,
  email: emailRouter,
  users: usersRouter,
  setup: setupRouter,
  vehicleRecords: vehicleRecordsRouter,
  inspections: inspectionsRouter,
  checklists: checklistsRouter,
  imports: importsRouter,
  marketing: marketingRouter,
  tasks: tasksRouter,
  reports: reportsRouter,
});

export const appRouter = router({
  customer: customerRouter,
  staff: staffRouter,
});

export type AppRouter = typeof appRouter;
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export const createCaller = createCallerFactory(appRouter);
export { createContext } from "./trpc";
export type { Wire } from "./transformer";
