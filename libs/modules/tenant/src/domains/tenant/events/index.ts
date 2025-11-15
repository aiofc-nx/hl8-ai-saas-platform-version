/**
 * @fileoverview 租户领域事件导出
 * @description 统一导出所有租户相关的领域事件
 */

export { TenantCreatedEvent } from "./tenant-created.event.js";
export type { TenantCreatedEventPayload } from "./tenant-created.event.js";

export { TenantActivatedEvent } from "./tenant-activated.event.js";
export type { TenantActivatedEventPayload } from "./tenant-activated.event.js";

export { TenantSuspendedEvent } from "./tenant-suspended.event.js";
export type { TenantSuspendedEventPayload } from "./tenant-suspended.event.js";

export { TenantArchivedEvent } from "./tenant-archived.event.js";
export type { TenantArchivedEventPayload } from "./tenant-archived.event.js";

export { TenantProfileUpdatedEvent } from "./tenant-profile-updated.event.js";
export type { TenantProfileUpdatedEventPayload } from "./tenant-profile-updated.event.js";
