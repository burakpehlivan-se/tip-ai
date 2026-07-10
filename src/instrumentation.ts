// Next.js instrumentation — ilk başlatmada DB seed
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { seedDefaultAdmin } = await import("./lib/admin/auth-env");
    await seedDefaultAdmin();
  }
}
