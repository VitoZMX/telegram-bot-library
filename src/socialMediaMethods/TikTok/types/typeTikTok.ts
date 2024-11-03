export interface TikTokResponseType {
  data: {
    id: string;
    title: string;
    play: string;
    wmplay: string;
    hdplay: string;
    music: string;
    music_info: {
      title: string;
      play: string;
      author: string;
      original: boolean;
      duration: number;
      album: string;
    };
    play_count: number;
    digg_count: number;
    comment_count: number;
    share_count: number;
    download_count: number;
    create_time: number;
    author: {
      id: string;
      unique_id: string;
      nickname: string;
      avatar: string;
    };
  };
}