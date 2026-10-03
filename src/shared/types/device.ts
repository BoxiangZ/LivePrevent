/**
 * 设备与数据新鲜度 — PRD §4.1 / §5.6 / §8.2
 */

export const DEVICE_TYPES = ["smartwatch", "camera"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

/** 设备离线 / 数据缺失事件类型 — PRD §5.6 */
export const DEVICE_DATA_GAP_TYPES = [
  "watch_not_worn", // 手表未佩戴
  "watch_low_battery", // 电量低
  "watch_disconnected", // 手表断连
  "camera_offline", // 摄像头断网
] as const;
export type DeviceDataGapType = (typeof DEVICE_DATA_GAP_TYPES)[number];

/** 摄像头端侧处理状态 — PRD §8.2：默认端侧处理，不持续上传视频 */
export type CameraProcessingMode = "edge_only" | "edge_with_snapshot_optin";

export interface Device {
  id: string;
  subjectId: string;
  type: DeviceType;
  /** 用户可读名称，如 "Living room camera" */
  label: string;
  online: boolean;
  /** 离线起点（在线时为 null）— 用于 §5.6 单设备 >2h / 全部 >4h 阈值计算 */
  offlineSince: string | null;
  /** 手表佩戴状态（摄像头恒为 null） */
  worn: boolean | null;
  /** 手表未佩戴起点（佩戴中或摄像头为 null） */
  notWornSince: string | null;
  batteryPct: number | null;
  /** 最近一次心跳/同步时间（ISO 8601） */
  lastSyncAt: string | null;
  /** 摄像头：覆盖的房间列表，用于覆盖地图与无活动歧义处理 — PRD §5.4 / §8.2 */
  coveredRooms: string[];
  /** 摄像头处理模式；手表恒为 null */
  cameraMode: CameraProcessingMode | null;
}

/** Dashboard 数据新鲜度行，如 "Watch worn · synced 2 min ago │ Camera online (Living room)" — PRD §5.6 */
export interface DataFreshness {
  deviceId: string;
  type: DeviceType;
  label: string;
  online: boolean;
  worn: boolean | null;
  lastSyncAt: string | null;
}
