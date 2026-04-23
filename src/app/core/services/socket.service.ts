import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

export type SocketConnectionStatus = 'OFFLINE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;
  readonly status = signal<SocketConnectionStatus>('OFFLINE');

  /** Connexion avec le JWT utilisateur (Authorization équivalent via `auth.token`). */
  connect(accessToken: string): Socket {
    if (this.socket?.connected && this.socket.auth && (this.socket.auth as { token?: string }).token === accessToken) {
      return this.socket;
    }
    this.disconnect();
    this.status.set('CONNECTING');
    this.socket = io(environment.wsUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      auth: { token: accessToken },
    });
    this.socket.on('connect', () => this.status.set('CONNECTED'));
    this.socket.on('disconnect', () => this.status.set('OFFLINE'));
    this.socket.io.on('reconnect_attempt', () => this.status.set('RECONNECTING'));
    this.socket.io.on('reconnect', () => this.status.set('CONNECTED'));
    this.socket.on('connect_error', () => {
      if (!this.socket?.connected) {
        this.status.set('OFFLINE');
      }
    });
    return this.socket;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.status.set('OFFLINE');
  }
}
