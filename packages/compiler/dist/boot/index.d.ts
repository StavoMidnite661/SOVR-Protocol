export declare function boot(rootDir: string, outDir: string): Promise<{
    passed: boolean;
    post: import("./post.js").POSTResult;
    bootloader?: undefined;
    sequence?: undefined;
} | {
    passed: boolean;
    post: import("./post.js").POSTResult;
    bootloader: import("./bootloader.js").BootloaderResult;
    sequence?: undefined;
} | {
    passed: boolean;
    post: import("./post.js").POSTResult;
    bootloader: import("./bootloader.js").BootloaderResult;
    sequence: import("./kernel-init.js").BootSequenceResult;
}>;
