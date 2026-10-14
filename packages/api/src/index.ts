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
