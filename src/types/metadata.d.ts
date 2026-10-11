declare module 'piexifjs' {
  export const version: string;
  export function load(jpegData: string): any;
  export function dump(exifObj: any): string;
  export function insert(exifStr: string, jpegData: string): string;
  export function remove(jpegData: string): string;
  export const TAGS: {
    '0th': Record<string, any>;
    Exif: Record<string, any>;
    GPS: Record<string, any>;
    Interop: Record<string, any>;
    '1st': Record<string, any>;
  };
  export const ImageIFD: Record<string, number>;
  export const ExifIFD: Record<string, number>;
  export const GPSIFD: Record<string, number>;
  export const InteropIFD: Record<string, number>;
  export const GPSHelper: {
    degToDmsRational(deg: number): number[][];
    dmsRationalToDeg(dmsArray: number[][], ref: string): number;
  };
  const piexif: {
    version: string;
    load(jpegData: string): any;
    dump(exifObj: any): string;
    insert(exifStr: string, jpegData: string): string;
    remove(jpegData: string): string;
    TAGS: any;
    ImageIFD: Record<string, number>;
    ExifIFD: Record<string, number>;
    GPSIFD: Record<string, number>;
    InteropIFD: Record<string, number>;
    GPSHelper: any;
  };
  export default piexif;
}

declare module 'browser-id3-writer' {
  export interface APICFrameOptions {
    type: number;
    data: ArrayBuffer | Uint8Array;
    description: string;
    useUnicodeEncoding?: boolean;
  }

  export class ID3Writer {
    constructor(buffer: ArrayBuffer);
    setFrame(frameName: 'TIT2' | 'TALB' | 'TYER' | 'TRCK' | 'COMM', value: any): this;
    setFrame(frameName: 'TPE1' | 'TCON', value: string[]): this;
    setFrame(frameName: 'APIC', value: APICFrameOptions): this;
    setFrame(frameName: string, value: any): this;
    addTag(): this;
    getURL(): string;
    revokeURL(): void;
    arrayBuffer: ArrayBuffer;
  }

  export default ID3Writer;
}
