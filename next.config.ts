import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // 개발 서버가 정적 경로를 확인할 때 별도 프로세스(child_process)를 띄우는데,
    // 이 프로세스가 반복적으로 죽는 "Jest worker encountered ... child process exceptions" 오류가
    // 계속 발생해서, 같은 프로세스 안에서 도는 워커 스레드 방식으로 전환해 회피한다.
    workerThreads: true,
  },
};

export default nextConfig;
