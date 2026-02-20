"use client";

import Script from "next/script";
import { useCallback, useEffect } from "react";

declare global {
	interface Window {
		naver: {
			maps: {
				Map: new (
					container: HTMLElement | string,
					options?: { center?: unknown; zoom?: number }
				) => unknown;
				LatLng: new (lat: number, lng: number) => unknown;
				Marker: new (options: { position: unknown; map: unknown }) => unknown;
			};
		};
		navermap_authFailure?: () => void;
	}
}

type Props = {
	lat: number;
	lng: number;
	libraryName: string;
};

export default function NaverMap({ lat, lng, libraryName }: Props) {
	const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

	const initMap = useCallback(() => {
		if (typeof window === "undefined" || !window.naver?.maps) return;

		const container = document.getElementById("map");
		if (!container || container.dataset.mapInitialized === "true") return;

		const position = new window.naver.maps.LatLng(lat, lng);
		const mapOptions = {
			center: position,
			zoom: 15,
		};
		const map = new window.naver.maps.Map("map", mapOptions);
		new window.naver.maps.Marker({ position, map });
		container.dataset.mapInitialized = "true";
	}, [lat, lng]);

	useEffect(() => {
		window.navermap_authFailure = () => {
			console.error("[NaverMap] 인증 실패: ncpKeyId를 확인해주세요.");
		};
		return () => {
			delete window.navermap_authFailure;
		};
	}, []);

	// Script cached (e.g. after client nav): naver already loaded, init immediately
	useEffect(() => {
		if (!clientId) return;
		if (typeof window !== "undefined" && window.naver?.maps) {
			initMap();
		}
	}, [clientId, initMap]);

	if (!clientId) {
		return (
			<div className="flex h-[200px] w-full items-center justify-center overflow-hidden rounded-2xl bg-neutral-200">
				<span className="text-sm text-foreground/60">
					지도 API 키가 필요합니다.
				</span>
			</div>
		);
	}

	return (
		<>
			<Script
				strategy="afterInteractive"
				src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`}
				onLoad={initMap}
			/>
			<div
				id="map"
				className="h-[200px] w-full overflow-hidden rounded-2xl bg-neutral-200"
				aria-label={`${libraryName} 위치 지도`}
			/>
		</>
	);
}
