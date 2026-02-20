"use client";

import Script from "next/script";
import { useRef, useState } from "react";

declare global {
	interface Window {
		naver: {
			maps: {
				Map: new (
					container: HTMLElement | string,
					options?: { center?: unknown; zoom?: number },
				) => unknown;
				LatLng: new (lat: number, lng: number) => unknown;
				Marker: new (options: {
					position: unknown;
					map: unknown;
				}) => unknown;
			};
		};
	}
}

type Props = {
	lat: number;
	lng: number;
	libraryName: string;
};

export default function NaverMap({ lat, lng, libraryName }: Props) {
	const mapRef = useRef<HTMLDivElement>(null);

	const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

	if (!clientId) {
		return (
			<div className="mb-4 flex h-[200px] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/40 bg-white/60">
				<span className="text-sm text-foreground/50">
					지도를 표시하려면 NEXT_PUBLIC_NAVER_MAP_CLIENT_ID를 설정해
					주세요.
				</span>
			</div>
		);
	}

	const handleScriptLoad = () => {
		if (!mapRef.current || !window.naver?.maps) return;

		const position = new window.naver.maps.LatLng(lat, lng);
		const map = new window.naver.maps.Map(mapRef.current, {
			center: position,
			zoom: 16,
		});

		new window.naver.maps.Marker({
			position,
			map,
		});
	};

	return (
		<>
			<Script
				strategy="afterInteractive"
				src={`https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}`}
				onLoad={handleScriptLoad}
			/>
			<div
				ref={mapRef}
				className="mb-4 h-[200px] w-full overflow-hidden rounded-2xl"
				aria-label={`${libraryName} 위치 지도`}
			/>
		</>
	);
}
