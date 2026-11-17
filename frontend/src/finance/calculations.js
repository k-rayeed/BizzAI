export function previousRange(start, end) {
  const first = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  const day = 86400000;
  const days = Math.round((last - first) / day) + 1;

  return {
    start: new Date(+first - days * day).toISOString().slice(0, 10),
    end: new Date(+first - day).toISOString().slice(0, 10),
  };
}

export function summarize(rows, start, end, currency) {
  const selected = rows.filter(
    (row) =>
      row.currency === currency &&
      row.entry_date >= start &&
      row.entry_date <= end
  );

  const sum = (kind) =>
    selected
      .filter((row) => row.kind === kind)
      .reduce(
        (total, row) => total + Math.round(Number(row.amount) * 100),
        0
      );

  const sales = sum("sale");
  const income = sales + sum("income");
  const expenses = sum("expense");

  return {
    sales: sales / 100,
    income: income / 100,
    expenses: expenses / 100,
    profit: (income - expenses) / 100,
    selected,
  };
}

export function change(current, previous) {
  if (previous === 0) {
    return current === 0 ? "No change" : "No prior baseline";
  }

  const percentage = ((current - previous) / Math.abs(previous)) * 100;
  return `${percentage.toFixed(1)}% vs previous period`;
}

export function grouped(rows, group) {
  const buckets = new Map();

  for (const row of rows) {
    const key =
      group === "category"
        ? row.category
        : row.entry_date.slice(0, group === "month" ? 7 : 10);

    const bucket = buckets.get(key) || {
      label: key,
      income: 0,
      sales: 0,
      expenses: 0,
    };

    const cents = Math.round(Number(row.amount) * 100);

    if (row.kind === "expense") {
      bucket.expenses += cents;
    } else {
      bucket.income += cents;
      if (row.kind === "sale") bucket.sales += cents;
    }

    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      income: bucket.income / 100,
      sales: bucket.sales / 100,
      expenses: bucket.expenses / 100,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}