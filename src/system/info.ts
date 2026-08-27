import { readFile, statfs } from "node:fs/promises";
import os from "node:os";

export interface SystemInfo {
  memory: {
    total: number;
    available: number;
    used: number;
    swapTotal: number;
    swapUsed: number;
  };
  load: [number, number, number];
  uptimeSeconds: number;
  disk: {
    path: string;
    total: number;
    used: number;
  };
  process: {
    pid: number;
    uptimeSeconds: number;
    rss: number;
    heapUsed: number;
    heapTotal: number;
    vmPeak?: number;
    vmHwm?: number;
    cgroupPeak?: number;
    cgroupCurrent?: number;
  };
  runtime: {
    node: string;
    platform: string;
    arch: string;
  };
}

function parseMemInfoValue(line: string): number | null {
  const match = line.match(/^[^:]+:\s+(\d+)\s+kB$/);
  return match ? Number(match[1]!) * 1024 : null;
}

async function readMemInfo(): Promise<{
  total: number;
  available: number;
  swapTotal: number;
  swapFree: number;
}> {
  const raw = await readFile("/proc/meminfo", "utf8");
  let total = 0;
  let available = 0;
  let swapTotal = 0;
  let swapFree = 0;

  for (const line of raw.split("\n")) {
    if (line.startsWith("MemTotal:")) {
      total = parseMemInfoValue(line) ?? total;
    } else if (line.startsWith("MemAvailable:")) {
      available = parseMemInfoValue(line) ?? available;
    } else if (line.startsWith("SwapTotal:")) {
      swapTotal = parseMemInfoValue(line) ?? swapTotal;
    } else if (line.startsWith("SwapFree:")) {
      swapFree = parseMemInfoValue(line) ?? swapFree;
    }
  }

  return { total, available, swapTotal, swapFree };
}

async function readProcessStatus(): Promise<{ vmPeak?: number; vmHwm?: number }> {
  try {
    const raw = await readFile("/proc/self/status", "utf8");
    let vmPeak: number | undefined;
    let vmHwm: number | undefined;

    for (const line of raw.split("\n")) {
      if (line.startsWith("VmPeak:")) {
        vmPeak = parseMemInfoValue(line) ?? undefined;
      } else if (line.startsWith("VmHWM:")) {
        vmHwm = parseMemInfoValue(line) ?? undefined;
      }
    }

    return { vmPeak, vmHwm };
  } catch {
    return {};
  }
}

async function readCgroupMemory(): Promise<{ peak?: number; current?: number }> {
  try {
    const cgroup = await readFile("/proc/self/cgroup", "utf8");
    const match = cgroup.match(/^0::(.+)$/m);
    if (!match?.[1]) return {};

    const base = `/sys/fs/cgroup${match[1]}`;
    const [peakRaw, currentRaw] = await Promise.all([
      readFile(`${base}/memory.peak`, "utf8").catch(() => null),
      readFile(`${base}/memory.current`, "utf8").catch(() => null),
    ]);

    return {
      peak: peakRaw ? Number(peakRaw.trim()) : undefined,
      current: currentRaw ? Number(currentRaw.trim()) : undefined,
    };
  } catch {
    return {};
  }
}

async function readDiskUsage(
  targetPath: string,
): Promise<{ path: string; total: number; used: number }> {
  const stats = await statfs(targetPath);
  const total = stats.bsize * stats.blocks;
  const free = stats.bsize * stats.bavail;
  return { path: targetPath, total, used: total - free };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDuration(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const days = Math.floor(wholeSeconds / 86_400);
  const hours = Math.floor((wholeSeconds % 86_400) / 3_600);
  const minutes = Math.floor((wholeSeconds % 3_600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export async function collectSystemInfo(): Promise<SystemInfo> {
  const [memInfo, processStatus, cgroupMemory, disk] = await Promise.all([
    readMemInfo(),
    readProcessStatus(),
    readCgroupMemory(),
    readDiskUsage("/"),
  ]);

  const memoryUsage = process.memoryUsage();

  return {
    memory: {
      total: memInfo.total,
      available: memInfo.available,
      used: memInfo.total - memInfo.available,
      swapTotal: memInfo.swapTotal,
      swapUsed: memInfo.swapTotal - memInfo.swapFree,
    },
    load: os.loadavg() as [number, number, number],
    uptimeSeconds: os.uptime(),
    disk,
    process: {
      pid: process.pid,
      uptimeSeconds: process.uptime(),
      rss: memoryUsage.rss,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      vmPeak: processStatus.vmPeak,
      vmHwm: processStatus.vmHwm,
      cgroupPeak: cgroupMemory.peak,
      cgroupCurrent: cgroupMemory.current,
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };
}

export function formatSystemInfo(info: SystemInfo): string {
  const lines = [
    "**System**",
    `RAM: ${formatBytes(info.memory.used)} / ${formatBytes(info.memory.total)} used (${formatBytes(info.memory.available)} available)`,
    info.memory.swapTotal > 0
      ? `Swap: ${formatBytes(info.memory.swapUsed)} / ${formatBytes(info.memory.swapTotal)} used`
      : "Swap: none",
    `Load: ${info.load.map((value) => value.toFixed(2)).join(", ")}`,
    `Uptime: ${formatDuration(info.uptimeSeconds)}`,
    "",
    "**dmini process**",
    `PID: ${info.process.pid}`,
    `Uptime: ${formatDuration(info.process.uptimeSeconds)}`,
    `RSS: ${formatBytes(info.process.rss)}`,
    `Heap: ${formatBytes(info.process.heapUsed)} / ${formatBytes(info.process.heapTotal)}`,
  ];

  if (info.process.cgroupPeak !== undefined) {
    lines.push(`Peak (cgroup): ${formatBytes(info.process.cgroupPeak)}`);
  }
  if (info.process.cgroupCurrent !== undefined) {
    lines.push(`Current (cgroup): ${formatBytes(info.process.cgroupCurrent)}`);
  }
  if (info.process.vmPeak !== undefined) {
    lines.push(`Peak (VmPeak): ${formatBytes(info.process.vmPeak)}`);
  }
  if (info.process.vmHwm !== undefined) {
    lines.push(`Peak RSS (VmHWM): ${formatBytes(info.process.vmHwm)}`);
  }

  lines.push(
    "",
    "**Disk**",
    `/: ${formatBytes(info.disk.used)} / ${formatBytes(info.disk.total)} used (${Math.round((info.disk.used / info.disk.total) * 100)}%)`,
    "",
    "**Runtime**",
    `Node ${info.runtime.node} · ${info.runtime.platform}/${info.runtime.arch}`,
  );

  return lines.join("\n");
}
