export interface YouTubeFormat {
    format_id: string;
    ext: string;
    height?: number;
    width?: number;
    vcodec?: string;
    acodec?: string;
    abr?: number;
    tbr?: number;
    filesize?: number;
}

export interface YouTubeVideoInfo {
    title: string;
    uploader?: string;
    view_count?: number;
    like_count?: number;
    duration?: number;
    formats: YouTubeFormat[];
}

export interface YouTubeShortsVideoResult {
    buffer: Buffer;
    info: Pick<YouTubeVideoInfo, 'title' | 'uploader' | 'view_count' | 'like_count' | 'duration'>;
}
