import type { TaskStatus } from "@second-space/shared-types";
export interface Point {
    x: number;
    y: number;
}
export declare const OFFICE_WAYPOINTS: {
    readonly lobby: {
        readonly x: 120;
        readonly y: 120;
    };
    readonly directorDesk: {
        readonly x: 260;
        readonly y: 110;
    };
    readonly managerDeskA: {
        readonly x: 320;
        readonly y: 200;
    };
    readonly managerDeskB: {
        readonly x: 240;
        readonly y: 230;
    };
    readonly specialistPodA: {
        readonly x: 390;
        readonly y: 280;
    };
    readonly specialistPodB: {
        readonly x: 455;
        readonly y: 260;
    };
    readonly meetingRoom: {
        readonly x: 170;
        readonly y: 300;
    };
    readonly waitingArea: {
        readonly x: 90;
        readonly y: 280;
    };
    readonly breakArea: {
        readonly x: 510;
        readonly y: 160;
    };
};
export type WaypointName = keyof typeof OFFICE_WAYPOINTS;
export declare function waypointForTaskStatus(status: TaskStatus): WaypointName;
export declare function getWaypoint(name: WaypointName): Point;
