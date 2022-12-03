export function fromMins(unixMins: number): Date {
    return new Date(60_000 * unixMins);
}

export function toMins(date: Date): number {
    return Math.round(+date / 60_000);
}
