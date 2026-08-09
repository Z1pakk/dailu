using Microsoft.Extensions.DependencyInjection;
using Tag.DataTransfer.Services;

namespace Tag.DataTransfer;

public static class Setup
{
    extension(IServiceCollection services)
    {
        public IServiceCollection AddTagDataTransferServices()
        {
            services.AddScoped<ITagDataTransferService, TagDataTransferService>();

            return services;
        }
    }
}
