using Mediator;

namespace SharedKernel.CQRS;

public interface IQuery<out T> : IRequest<T>
    where T : notnull { }
