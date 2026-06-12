import Papa from "papaparse";
import { useMemo } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface Props {
	content: string;
	ext: string; // "csv" or "tsv"
	className?: string;
}

interface ParsedCsv {
	headers: string[];
	rows: Record<string, string>[];
}

function parseCsv(content: string, ext: string): ParsedCsv {
	const delimiter = ext === "tsv" ? "\t" : undefined;
	const result = Papa.parse(content, {
		delimiter,
		header: true,
		skipEmptyLines: true,
	});

	if (result.errors.length > 0 && result.data.length === 0) {
		// Fallback: parse without headers
		const fallback = Papa.parse(content, { delimiter, skipEmptyLines: true });
		const headers = (fallback.data[0] ?? []) as string[];
		const rows: Record<string, string>[] = (fallback.data.slice(1) as string[][]).map((vals) =>
			headers.reduce<Record<string, string>>((acc, h, i) => {
				acc[h] = vals[i] ?? "";
				return acc;
			}, {}),
		);
		return { headers, rows };
	}

	const headers = (result.meta.fields ?? []) as string[];
	const rows = result.data as Record<string, string>[];
	return { headers, rows };
}

export function CsvPreview({ content, ext, className }: Props) {
	const parsed = useMemo(() => parseCsv(content, ext), [content, ext]);
	const { headers, rows } = parsed;
	const maxCols = 8;

	return (
		<ScrollArea className={className}>
			<div className="min-w-full px-4 py-4">
				<table className="w-full border-collapse text-[13px]">
					<thead>
						<tr className="border-b border-border/40">
							{headers.slice(0, maxCols).map((h, i) => (
								<th
									key={i}
									className="px-3 py-2 text-left text-muted-foreground font-medium whitespace-nowrap"
								>
									{h}
								</th>
							))}
							{headers.length > maxCols && (
								<th className="px-3 py-2 text-left text-muted-foreground/50 font-medium">
									+{headers.length - maxCols} more
								</th>
							)}
						</tr>
					</thead>
					<tbody>
						{rows.slice(0, 200).map((row, ri) => (
							<tr
								key={ri}
								className="border-b border-border/20 hover:bg-muted/30 transition-colors duration-150"
							>
								{headers.slice(0, maxCols).map((h, ci) => (
									<td key={ci} className="px-3 py-1.5 whitespace-nowrap text-foreground">
										{row[h] ?? ""}
									</td>
								))}
								{headers.length > maxCols && (
									<td className="px-3 py-1.5 text-muted-foreground/50">…</td>
								)}
							</tr>
						))}
					</tbody>
				</table>
				{rows.length > 200 && (
					<div className="mt-3 text-[12px] text-muted-foreground text-center">
						Showing 200 of {rows.length} rows
					</div>
				)}
			</div>
			<ScrollBar orientation="horizontal" />
		</ScrollArea>
	);
}
