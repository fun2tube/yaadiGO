import "server-only";

import { register } from "@/lib/crm/notifications";

/**
 * The CRM's wiring point.
 *
 * Subscribers have to be registered before the first event is emitted, and a
 * module only runs when something imports it — so a route that emits without
 * importing this would write the event and notify nobody, silently. Importing
 * `@/lib/crm` from every route that emits makes that impossible to forget.
 *
 * `registered` guards against double-registration: in development Next
 * re-evaluates modules on hot reload, and without it every reload would add
 * another copy of each handler and send duplicate notifications.
 */

let registered = false;

if (!registered) {
  register();
  registered = true;
}

export { emit, listEvents, timelineFor } from "@/lib/crm/events";
